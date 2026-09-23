import { beforeEach, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { players, scoreRevisions, scores } from "@/db/schema";
import { getPlayersForAdmin, getScores, saveEntry } from "@/lib/queries";
import { parsePaste } from "@/lib/parser";
import { fixture, SUBMITTED_AT } from "@/lib/parser/__tests__/fixtures";

async function reset() {
  await db.execute(
    sql`truncate table ${scoreRevisions}, ${scores}, ${players} restart identity cascade`,
  );
}

async function makePlayer(handle: string) {
  const [p] = await db
    .insert(players)
    .values({
      email: `${handle}@halda.ai`,
      displayName: handle,
      handle,
    })
    .returning();
  return p;
}

const entryFrom = (file: string, index = 0) =>
  parsePaste(fixture(file), { submittedAt: SUBMITTED_AT }).entries[index];

describe("saveEntry", () => {
  beforeEach(reset);

  it("inserts a new score with its source text and rounds", async () => {
    const p = await makePlayer("riley");
    const entry = entryFrom("maptap-slack-shortcodes.txt");

    const result = await saveEntry(p.id, entry);
    expect(result.replaced).toBeNull();

    const rows = await db.select().from(scores);
    expect(rows).toHaveLength(1);
    expect(rows[0].rawScore).toBe(872);
    expect(rows[0].rounds).toEqual([99, 80, 93, 80, 89]);
    expect(rows[0].puzzleDate).toBe("2026-09-18");
    // Keeping the paste is what makes a later parser fix a replay, not a re-import.
    expect(rows[0].sourceText).toContain("Final score: 872");
  });

  it("overwrites in place and preserves the old value in the revision log", async () => {
    const p = await makePlayer("riley");
    await saveEntry(p.id, entryFrom("maptap-slack-shortcodes.txt"));

    const corrected = { ...entryFrom("maptap-slack-shortcodes.txt"), score: 900 };
    const result = await saveEntry(p.id, corrected);

    expect(result.replaced).toBe(872);
    const rows = await db.select().from(scores);
    expect(rows).toHaveLength(1);
    expect(rows[0].rawScore).toBe(900);

    const revs = await db.select().from(scoreRevisions);
    expect(revs).toHaveLength(1);
    expect(revs[0].rawScore).toBe(872);
    expect(revs[0].scoreId).toBe(rows[0].id);
  });

  it("keeps one row per player, game and date across repeated saves", async () => {
    const p = await makePlayer("riley");
    for (let i = 0; i < 4; i++) {
      await saveEntry(p.id, { ...entryFrom("maptap-slack-shortcodes.txt"), score: 800 + i });
    }
    const rows = await db.select().from(scores);
    expect(rows).toHaveLength(1);
    expect(rows[0].rawScore).toBe(803);
    expect(await db.select().from(scoreRevisions)).toHaveLength(3);
  });

  it("keeps different players' scores separate", async () => {
    const a = await makePlayer("riley");
    const b = await makePlayer("zach");
    await saveEntry(a.id, entryFrom("maptap-slack-shortcodes.txt"));
    await saveEntry(b.id, entryFrom("maptap-slack-shortcodes.txt"));
    expect(await db.select().from(scores)).toHaveLength(2);
    expect(await db.select().from(scoreRevisions)).toHaveLength(0);
  });

  it("stores each game of a multi-game paste as its own row", async () => {
    const p = await makePlayer("riley");
    const parsed = parsePaste(fixture("multi-all-five-games.txt"), {
      submittedAt: SUBMITTED_AT,
    });
    for (const e of parsed.entries) await saveEntry(p.id, e);

    const rows = await db.select().from(scores);
    expect(rows).toHaveLength(5);
    expect(rows.map((r) => r.game).sort()).toEqual([
      "fermi", "globle", "krillion", "maptap", "size_it_up",
    ]);
    // Size It Up borrowed its date from a sibling rather than defaulting to today.
    expect(rows.find((r) => r.game === "size_it_up")!.puzzleDate).toBe("2026-09-16");
  });
});

describe("raw paste", () => {
  beforeEach(reset);

  it("stores the whole paste byte for byte, not just this game's block", async () => {
    const p = await makePlayer("riley");
    // CRLF and raw Unicode are what normalization rewrites, so they prove the
    // column holds the input rather than the normalized form.
    const paste = fixture("multi-all-five-games.txt").replace(/\n/g, "\r\n") + "\r\ngg 🎉";
    const entry = parsePaste(paste, { submittedAt: SUBMITTED_AT }).entries[0];
    await saveEntry(p.id, entry, "web", paste);

    const [row] = await db.select().from(scores);
    expect(row.rawPaste).toBe(paste);
    expect(row.sourceText.length).toBeLessThan(paste.length);
  });

  it("is null when no paste is given, as for the backfill", async () => {
    const p = await makePlayer("riley");
    await saveEntry(p.id, entryFrom("maptap-slack-shortcodes.txt"), "slack_backfill");
    const [row] = await db.select().from(scores);
    expect(row.rawPaste).toBeNull();
  });

  it("copies the old paste into the revision on replace", async () => {
    const p = await makePlayer("riley");
    const first = fixture("maptap-slack-shortcodes.txt");
    const second = fixture("maptap-unicode-emoji.txt");
    await saveEntry(p.id, entryFrom("maptap-slack-shortcodes.txt"), "web", first);
    await saveEntry(p.id, entryFrom("maptap-unicode-emoji.txt"), "web", second);

    const [row] = await db.select().from(scores);
    const [rev] = await db.select().from(scoreRevisions);
    expect(row.rawPaste).toBe(second);
    expect(rev.rawPaste).toBe(first);
  });

  it("exposes detail and whether the art is verified, never the paste", async () => {
    const p = await makePlayer("riley");
    await saveEntry(
      p.id,
      entryFrom("krillion-mixed-tiles-unicode.txt"),
      "web",
      fixture("krillion-mixed-tiles-unicode.txt"),
    );
    await saveEntry(p.id, entryFrom("maptap-slack-shortcodes.txt"), "slack_backfill");

    const rows = await getScores();
    const krillion = rows.find((r) => r.game === "krillion")!;
    const maptap = rows.find((r) => r.game === "maptap")!;
    expect(krillion.artVerified).toBe(true);
    expect(krillion.detail).toMatchObject({
      kind: "krillion",
      tiles: ["bubbles", "squid", "fish", "fish", "fish", "fish", "fish"],
    });
    expect(maptap.artVerified).toBe(false);
    expect(maptap.detail).toMatchObject({ kind: "maptap", rounds: [99, 80, 93, 80, 89] });
    expect(Object.keys(krillion)).not.toContain("rawPaste");
  });
});

describe("database constraints", () => {
  beforeEach(reset);

  it("rejects a duplicate (player, game, date) insert", async () => {
    const p = await makePlayer("riley");
    const base = {
      playerId: p.id,
      game: "maptap" as const,
      puzzleDate: "2026-09-18",
      rawScore: 872,
      sourceText: "x",
    };
    await db.insert(scores).values(base);
    await expect(db.insert(scores).values(base)).rejects.toThrow();
  });

  it("rejects a non-lowercase email", async () => {
    await expect(
      db.insert(players).values({
        email: "Riley@Halda.ai",
        displayName: "Riley",
        handle: "riley-upper",
      }),
    ).rejects.toThrow();
  });

  it("rejects a duplicate handle", async () => {
    await makePlayer("riley");
    await expect(
      db.insert(players).values({
        email: "other@halda.ai",
        displayName: "Other",
        handle: "riley",
      }),
    ).rejects.toThrow();
  });

  it("cascades score deletion when a player is removed", async () => {
    const p = await makePlayer("riley");
    await saveEntry(p.id, entryFrom("maptap-slack-shortcodes.txt"));
    await db.delete(players);
    expect(await db.select().from(scores)).toHaveLength(0);
  });
});

/**
 * These counts were silently zero for every row once: written as correlated
 * subqueries in a `sql` template, Drizzle rendered the columns unqualified, so
 * `where score_id = id` compared two columns of the inner table. Nothing failed
 * — the numbers were just always 0. Assert real counts, not just a shape.
 */
describe("row counts", () => {
  beforeEach(reset);

  it("counts each player's scores, and zero for a player with none", async () => {
    const riley = await makePlayer("riley");
    await makePlayer("owen");
    await saveEntry(riley.id, entryFrom("maptap-slack-shortcodes.txt"));
    await saveEntry(riley.id, entryFrom("krillion-daily-shortcodes.txt"));

    const rows = await getPlayersForAdmin();
    const byName = Object.fromEntries(rows.map((r) => [r.handle, r.scoreCount]));
    expect(byName).toEqual({ riley: 2, owen: 0 });
  });

  it("counts revisions per score", async () => {
    const p = await makePlayer("riley");
    const entry = entryFrom("maptap-slack-shortcodes.txt");
    await saveEntry(p.id, entry);

    let [row] = await getScores();
    expect(row.revisionCount).toBe(0);

    // Same (player, game, date), so this overwrites and banks a revision.
    await saveEntry(p.id, { ...entry, score: 900 });
    [row] = await getScores();
    expect(row.rawScore).toBe(900);
    expect(row.revisionCount).toBe(1);

    await saveEntry(p.id, { ...entry, score: 910 });
    [row] = await getScores();
    expect(row.revisionCount).toBe(2);
  });

  it("keeps one row per score when a score has several revisions", async () => {
    const p = await makePlayer("riley");
    const entry = entryFrom("maptap-slack-shortcodes.txt");
    await saveEntry(p.id, entry);
    await saveEntry(p.id, { ...entry, score: 900 });
    // The join must not fan the score out into one row per revision.
    expect(await getScores()).toHaveLength(1);
  });
});
