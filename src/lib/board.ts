import { DAILY_GAMES, GAMES, type GameSlug } from "@/lib/games/config";
import { STREAK_MIN } from "@/lib/scoring/streaks";
import type { SortColumn } from "@/lib/sort";

/**
 * Sortable columns for the day board and the per-game standings. Every score
 * column's natural order is best-first, which for Globle and Fermi is smallest
 * first — `direction` decides, the same way it does everywhere else.
 */

export interface DayRow {
  name: string;
  streak: number | undefined;
  scores: Partial<Record<GameSlug, number>>;
}

export const DAY_DEFAULT_SORT = "player";

export function dayColumns<T extends DayRow>(): SortColumn<T>[] {
  return [
    { key: "player", value: (r) => r.name, descending: false },
    // Below STREAK_MIN no badge shows, so those rows sort with the players who
    // have no streak rather than above them for a reason nobody can see.
    {
      key: "streak",
      value: (r) => (r.streak !== undefined && r.streak >= STREAK_MIN ? r.streak : null),
      descending: true,
    },
    ...DAILY_GAMES.map((g) => ({
      key: g.slug,
      value: (r: T) => r.scores[g.slug] ?? null,
      descending: g.direction === 1,
    })),
  ];
}

/**
 * Each daily game's best score on the board, by `direction`. A game only one
 * player logged has no entry: the same rule as a slot with n = 1, which earns no
 * z. A trophy for playing alone would go to whoever posts first.
 */
export function bestScores(rows: DayRow[]): Partial<Record<GameSlug, number>> {
  const best: Partial<Record<GameSlug, number>> = {};
  for (const g of DAILY_GAMES) {
    const scores = rows.flatMap((r) => r.scores[g.slug] ?? []);
    if (scores.length < 2) continue;
    best[g.slug] = g.direction === 1 ? Math.max(...scores) : Math.min(...scores);
  }
  return best;
}

export interface GameStandingRow {
  name: string;
  avgZ: number | null;
  avgRaw: number;
  best: number;
  entries: number;
}

export const GAME_DEFAULT_SORT = "z";

export function gameColumns<T extends GameStandingRow>(game: GameSlug): SortColumn<T>[] {
  const higherBetter = GAMES[game].direction === 1;
  return [
    { key: "player", value: (r) => r.name, descending: false },
    { key: "z", value: (r) => r.avgZ, descending: true },
    { key: "avg", value: (r) => r.avgRaw, descending: higherBetter },
    { key: "best", value: (r) => r.best, descending: higherBetter },
    { key: "played", value: (r) => r.entries, descending: true },
  ];
}
