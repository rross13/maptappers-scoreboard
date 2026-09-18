/**
 * One-time backfill of the Slack history.
 *
 * Runs the same parsers the app uses over every archived message. Defaults to a
 * dry run that reports the parse rate and every low-confidence read, because the
 * typed Globle scores genuinely need a human to look at them before they land.
 *
 *   npx tsx --env-file=.env.local scripts/backfill.ts --dry-run
 *   npx tsx --env-file=.env.local scripts/backfill.ts --commit [--include-low-confidence]
 */
import { readFileSync } from "node:fs";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { players, scores, unparsedPastes } from "@/db/schema";
import { parsePaste, PARSER_VERSION, SCOREBOARD_TZ, type ParsedEntry } from "@/lib/parser";
import { GAMES, type GameSlug } from "@/lib/games/config";

interface Message {
  ts: string;
  author: string;
  text: string;
}

const args = new Set(process.argv.slice(2));
const COMMIT = args.has("--commit");
const INCLUDE_LOW = args.has("--include-low-confidence");

interface Parsed {
  msg: Message;
  entry: ParsedEntry;
}

async function main() {
  const messages: Message[] = JSON.parse(
    readFileSync("data/slack-history.json", "utf8"),
  );

  const roster = await db.select().from(players);
  const byEmail = new Map(roster.map((p) => [p.email.toLowerCase(), p]));

  const confident: Parsed[] = [];
  const lowConfidence: Parsed[] = [];
  const failures: { msg: Message; reason: string }[] = [];
  const nearMisses: { msg: Message; why: string }[] = [];
  const unknownAuthors = new Set<string>();

  // Phrasings the freeform matcher deliberately will not touch, because the
  // number precedes the keyword or the keyword is absent entirely. Guessing at
  // these would invent scores; ignoring them silently would lose real ones, so
  // they are reported for a human instead.
  const NEAR_MISS = [
    { re: /\b\d{1,2}\s+on\s+globl?e\b/i, why: "count before the keyword" },
    { re: /\bgot it in\s+\d{1,2}\b/i, why: "no game named" },
  ];

  for (const msg of messages) {
    if (!byEmail.has(msg.author.toLowerCase())) unknownAuthors.add(msg.author);

    const result = parsePaste(msg.text, {
      // The message's own timestamp, so submission-day fallbacks land on the day
      // it was actually posted rather than today.
      submittedAt: new Date(msg.ts),
      timeZone: SCOREBOARD_TZ,
    });

    for (const entry of result.entries) {
      (entry.scoreConfidence === "low" ? lowConfidence : confident).push({ msg, entry });
    }
    const gotGloble = result.entries.some((e) => e.game === "globle");
    if (!gotGloble) {
      for (const { re, why } of NEAR_MISS) {
        if (re.test(msg.text)) {
          nearMisses.push({ msg, why });
          break;
        }
      }
    }

    for (const f of result.failures) {
      failures.push({
        msg,
        reason: `${f.displayName}: ${f.issues.map((i) => i.message).join("; ")}`,
      });
    }
  }

  // ---- report ----
  const perGame = new Map<GameSlug, number>();
  for (const { entry } of confident) {
    perGame.set(entry.game, (perGame.get(entry.game) ?? 0) + 1);
  }

  console.log(`\nMessages scanned:        ${messages.length}`);
  console.log(`Confident entries:       ${confident.length}`);
  console.log(`Low-confidence entries:  ${lowConfidence.length}`);
  console.log(`Failed blocks:           ${failures.length}`);

  console.log("\nPer game (confident):");
  for (const slug of Object.keys(GAMES) as GameSlug[]) {
    const n = perGame.get(slug) ?? 0;
    if (n > 0) console.log(`  ${GAMES[slug].name.padEnd(14)} ${n}`);
  }

  const dates = [...new Set(confident.map((c) => c.entry.puzzleDate))].sort();
  console.log(`\nDate span: ${dates[0]} -> ${dates.at(-1)} (${dates.length} days)`);

  if (unknownAuthors.size > 0) {
    console.log(`\nUnknown authors: ${[...unknownAuthors].join(", ")}`);
  }

  if (lowConfidence.length > 0) {
    console.log("\nNEEDS REVIEW - typed Globle scores, not in share format:");
    for (const { msg, entry } of lowConfidence) {
      const who = byEmail.get(msg.author.toLowerCase())?.displayName ?? msg.author;
      console.log(
        `  ${entry.puzzleDate}  ${who.padEnd(14)} ${String(entry.score).padStart(3)}  "${msg.text.split("\n")[0].slice(0, 60)}"`,
      );
    }
  }

  if (nearMisses.length > 0) {
    console.log(
      "\nNOT CAPTURED - looks like a Globle score the parser will not guess at:",
    );
    for (const { msg, why } of nearMisses) {
      const who = byEmail.get(msg.author.toLowerCase())?.displayName ?? msg.author;
      console.log(
        `  ${msg.ts.slice(0, 10)}  ${who.padEnd(14)} (${why})  "${msg.text.split("\n")[0].slice(0, 60)}"`,
      );
    }
    console.log("  -> add these by hand in the app if you want them counted.");
  }

  if (failures.length > 0) {
    console.log("\nFailed to parse:");
    for (const f of failures) {
      console.log(`  ${f.msg.ts.slice(0, 10)} ${f.msg.author}: ${f.reason}`);
    }
  }

  if (!COMMIT) {
    console.log("\nDry run - nothing written. Re-run with --commit to write.");
    console.log(
      INCLUDE_LOW
        ? "(--include-low-confidence is set, so the reviewed rows above would be written too.)"
        : "(Add --include-low-confidence to also write the rows flagged above.)",
    );
    process.exit(0);
  }

  // ---- commit ----
  const toWrite = INCLUDE_LOW ? [...confident, ...lowConfidence] : confident;
  let inserted = 0;
  let skipped = 0;
  let quarantined = 0;

  for (const { msg, entry } of toWrite) {
    const player = byEmail.get(msg.author.toLowerCase());
    if (!player) {
      await db.insert(unparsedPastes).values({
        sourceText: msg.text,
        slackTs: msg.ts,
        reason: `unknown author ${msg.author}`,
      });
      quarantined += 1;
      continue;
    }

    // Insert-if-absent rather than upsert: re-running the backfill must not
    // churn the revision log or overwrite a correction made in the app.
    const [existing] = await db
      .select({ id: scores.id })
      .from(scores)
      .where(
        and(
          eq(scores.playerId, player.id),
          eq(scores.game, entry.game),
          eq(scores.puzzleDate, entry.puzzleDate),
        ),
      );

    if (existing) {
      skipped += 1;
      continue;
    }

    await db.insert(scores).values({
      playerId: player.id,
      game: entry.game,
      puzzleDate: entry.puzzleDate,
      puzzleNumber: entry.puzzleNumber ?? null,
      rawScore: entry.score,
      rounds: entry.detail && "rounds" in entry.detail ? entry.detail.rounds : null,
      meta: entry.detail as Record<string, unknown> | undefined,
      sourceText: entry.sourceText,
      source: "slack_backfill",
      parserVersion: PARSER_VERSION,
    });
    inserted += 1;
  }

  for (const f of failures) {
    await db.insert(unparsedPastes).values({
      sourceText: f.msg.text,
      slackTs: f.msg.ts,
      reason: f.reason,
    });
    quarantined += 1;
  }

  console.log(`\nInserted:    ${inserted}`);
  console.log(`Skipped:     ${skipped} (already present)`);
  console.log(`Quarantined: ${quarantined}`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
