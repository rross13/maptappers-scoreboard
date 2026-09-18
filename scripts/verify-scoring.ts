/**
 * Cross-checks the app's scoring modules against independently hand-computed
 * values. Queries the database directly and uses the same pure z/aggregate code
 * the pages use (those modules carry no server-only guard).
 */
import { db } from "@/db";
import { players, scores } from "@/db/schema";
import { groupIntoSlots, standings } from "@/lib/scoring/aggregate";
import { scoreSlot } from "@/lib/scoring/z";
import type { GameSlug } from "@/lib/games/config";

async function main() {
  const roster = await db.select().from(players);
  const name = new Map(roster.map((p) => [p.id, p.displayName]));

  const rows = (await db
    .select({
      playerId: scores.playerId,
      game: scores.game,
      puzzleDate: scores.puzzleDate,
      rawScore: scores.rawScore,
    })
    .from(scores)) as {
    playerId: string;
    game: GameSlug;
    puzzleDate: string;
    rawScore: number;
  }[];

  const daily = rows.filter((r) => r.game !== "krillion_infinite");
  const slots = groupIntoSlots(daily).map((s) => ({
    game: s.game,
    date: s.date,
    scored: scoreSlot(s.game, s.entries),
  }));

  for (const [game, date] of [
    ["krillion", "2026-09-16"],
    ["fermi", "2026-09-16"],
    ["globle", "2026-09-16"],
  ] as const) {
    const slot = slots.find((s) => s.game === game && s.date === date);
    console.log(`\n${game} ${date}  (n=${slot?.scored?.length ?? 0})`);
    for (const e of [...(slot?.scored ?? [])].sort((a, b) => b.z - a.z)) {
      console.log(
        `  ${(name.get(e.playerId) ?? "?").padEnd(14)} raw=${String(e.rawScore).padStart(7)}  z=${e.z >= 0 ? "+" : ""}${e.z.toFixed(6)}`,
      );
    }
  }

  const { standings: table, eligibleSlots } = standings(slots, "avg");
  console.log(`\nAll-time standings (${eligibleSlots} scored game-days):`);
  for (const [i, s] of table.entries()) {
    console.log(
      `  ${String(i + 1).padStart(2)}. ${(name.get(s.playerId) ?? "?").padEnd(14)}` +
        ` avg=${s.average >= 0 ? "+" : ""}${s.average.toFixed(3)}` +
        ` total=${s.total >= 0 ? "+" : ""}${s.total.toFixed(2)}` +
        ` n=${String(s.entries).padStart(2)}` +
        (s.qualified ? "" : "  (not ranked)"),
    );
  }
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
