import type { GameSlug } from "@/lib/games/config";
import type { ScoredEntry } from "./z";

/**
 * Cross-game standings.
 *
 * Ranking on the sum of z rewards turnout over skill; ranking on a plain average
 * lets someone play only their best game and top the board off a handful of
 * entries. The participation floor is what makes the average safe.
 */

export const SHRINKAGE_K = 5;
export const PARTICIPATION_FLOOR = 0.5;

export interface Slot {
  game: GameSlug;
  date: string;
  scored: ScoredEntry[] | null;
}

export interface Standing {
  playerId: string;
  /** Number of scored entries this player has in the window. */
  entries: number;
  total: number;
  average: number;
  /** Shrinkage estimator: regresses thin records toward zero with no hard gate. */
  adjusted: number;
  qualified: boolean;
  /** Average z per game, for the breakdown strip. */
  byGame: Record<string, { entries: number; average: number }>;
}

export type Metric = "avg" | "total" | "adj";

/** The number a metric ranks on — what the board shows and sorts by. */
export function metricValue(s: Standing, metric: Metric): number {
  return metric === "total" ? s.total : metric === "adj" ? s.adjusted : s.average;
}

export function standings(
  slots: Slot[],
  metric: Metric = "avg",
): { standings: Standing[]; eligibleSlots: number } {
  const eligible = slots.filter((s) => s.scored !== null);

  const acc = new Map<
    string,
    { n: number; t: number; byGame: Map<GameSlug, { n: number; t: number }> }
  >();

  for (const slot of eligible) {
    for (const e of slot.scored!) {
      const cur = acc.get(e.playerId) ?? { n: 0, t: 0, byGame: new Map() };
      cur.n += 1;
      cur.t += e.z;
      const g = cur.byGame.get(slot.game) ?? { n: 0, t: 0 };
      g.n += 1;
      g.t += e.z;
      cur.byGame.set(slot.game, g);
      acc.set(e.playerId, cur);
    }
  }

  const floor = PARTICIPATION_FLOOR * eligible.length;

  const out: Standing[] = [...acc].map(([playerId, v]) => ({
    playerId,
    entries: v.n,
    total: v.t,
    average: v.t / v.n,
    adjusted: v.t / (v.n + SHRINKAGE_K),
    qualified: v.n >= floor,
    byGame: Object.fromEntries(
      [...v.byGame].map(([g, s]) => [g, { entries: s.n, average: s.t / s.n }]),
    ),
  }));

  // Unqualified players still appear, but always below the qualified ones.
  out.sort((a, b) =>
    a.qualified !== b.qualified ? (a.qualified ? -1 : 1) : metricValue(b, metric) - metricValue(a, metric),
  );

  return { standings: out, eligibleSlots: eligible.length };
}

/** Groups flat score rows into per-(game, date) slots ready for scoreSlot. */
export function groupIntoSlots<
  T extends { game: GameSlug; puzzleDate: string; playerId: string; rawScore: number },
>(rows: T[]): { game: GameSlug; date: string; entries: T[] }[] {
  const map = new Map<string, { game: GameSlug; date: string; entries: T[] }>();
  for (const r of rows) {
    const key = `${r.game}|${r.puzzleDate}`;
    const cur = map.get(key) ?? { game: r.game, date: r.puzzleDate, entries: [] };
    cur.entries.push(r);
    map.set(key, cur);
  }
  return [...map.values()];
}
