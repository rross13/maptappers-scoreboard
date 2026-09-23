import "server-only";
import { getPlayDays, getPlayers, getScores, type ScoreRow } from "@/lib/queries";
import { groupIntoSlots, standings, type Metric, type Slot } from "@/lib/scoring/aggregate";
import { streaks } from "@/lib/scoring/streaks";
import { scoreSlot } from "@/lib/scoring/z";
import { civilDateIn } from "@/lib/parser/dates";
import { SCOREBOARD_TZ } from "@/lib/parser";
import { addDays, asCivil } from "@/lib/parser/dates";

export type Range = "today" | "7d" | "30d" | "all";

export const RANGES: { key: Range; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "7d", label: "7 days" },
  { key: "30d", label: "30 days" },
  { key: "all", label: "All time" },
];

export function rangeBounds(range: Range): { from?: string; to?: string } {
  const today = civilDateIn(new Date(), SCOREBOARD_TZ);
  if (range === "all") return {};
  if (range === "today") return { from: today, to: today };
  const days = range === "7d" ? 6 : 29;
  return { from: addDays(asCivil(today), -days), to: today };
}

export function parseRange(value: string | undefined, fallback: Range): Range {
  return RANGES.some((r) => r.key === value) ? (value as Range) : fallback;
}

export function parseMetric(value: string | undefined): Metric {
  return value === "total" || value === "adj" ? value : "avg";
}

/** Scores every (game, date) slot in the window. Computed on read: the whole
 *  dataset is a few hundred KB, and the math is far easier to test in TS than
 *  as a window-function CTE. */
export function buildSlots(rows: ScoreRow[]): Slot[] {
  return groupIntoSlots(rows).map((s) => ({
    game: s.game,
    date: s.date,
    scored: scoreSlot(s.game, s.entries),
  }));
}

export async function getStandings(range: Range, metric: Metric) {
  const { from, to } = rangeBounds(range);
  const [roster, rows] = await Promise.all([getPlayers(), getScores(from, to)]);
  const slots = buildSlots(rows);
  const result = standings(slots, metric);
  const byId = new Map(roster.map((p) => [p.id, p]));
  return {
    ...result,
    rows,
    roster,
    named: result.standings.map((s) => ({
      ...s,
      player: byId.get(s.playerId),
    })),
  };
}

/** Current all-five-games streak per player id, in the scoreboard's timezone. */
export async function getStreaks(): Promise<Map<string, number>> {
  return streaks(await getPlayDays(), civilDateIn(new Date(), SCOREBOARD_TZ));
}
