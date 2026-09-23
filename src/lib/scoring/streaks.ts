import { DAILY_GAMES, type GameSlug } from "@/lib/games/config";
import { addDays } from "@/lib/parser/dates";
import type { CivilDate } from "@/lib/parser/types";

/** One day of five isn't a streak; the badge starts at two. */
export const STREAK_MIN = 2;

export interface PlayDay {
  playerId: string;
  game: GameSlug;
  puzzleDate: string;
}

/**
 * Consecutive days, by puzzle date, on which each player logged every daily
 * game, ending today.
 *
 * An incomplete today doesn't break a streak: the day is still in progress, so
 * counting starts from yesterday until today has all five. Players with no
 * streak are absent from the map.
 */
export function streaks(rows: PlayDay[], today: CivilDate): Map<string, number> {
  const daily = new Set<string>(DAILY_GAMES.map((g) => g.slug));
  const played = new Map<string, Set<string>>();
  for (const r of rows) {
    if (!daily.has(r.game)) continue;
    const key = `${r.playerId}|${r.puzzleDate}`;
    (played.get(key) ?? played.set(key, new Set()).get(key)!).add(r.game);
  }
  const complete = (playerId: string, date: CivilDate) =>
    played.get(`${playerId}|${date}`)?.size === daily.size;

  const result = new Map<string, number>();
  for (const playerId of new Set(rows.map((r) => r.playerId))) {
    let day = complete(playerId, today) ? today : addDays(today, -1);
    let n = 0;
    while (complete(playerId, day)) {
      n += 1;
      day = addDays(day, -1);
    }
    if (n > 0) result.set(playerId, n);
  }
  return result;
}
