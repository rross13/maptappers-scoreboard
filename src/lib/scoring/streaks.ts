import { DAILY_GAMES, type GameSlug } from "@/lib/games/config";
import { isWorkday, previousWorkday } from "./workdays";
import type { CivilDate } from "@/lib/parser/types";

/** One complete workday isn't a streak; the badge starts at two. */
export const STREAK_MIN = 2;

export interface PlayDay {
  playerId: string;
  game: GameSlug;
  puzzleDate: string;
}

/**
 * Consecutive workdays, by puzzle date, on which each player logged every daily
 * game, ending today.
 *
 * Weekends and observed federal holidays are skipped entirely: missing one never
 * breaks a streak, and playing one never adds to it. Most of the team only plays
 * on working days.
 *
 * An incomplete today doesn't break a streak: the day is still in progress, so
 * counting starts from the previous workday until today is complete. A game is
 * only required from its `streakFrom` date onward. Players with no streak are
 * absent from the map.
 */
export function streaks(rows: PlayDay[], today: CivilDate): Map<string, number> {
  const daily = new Set<string>(DAILY_GAMES.map((g) => g.slug));
  const required = (date: CivilDate) =>
    DAILY_GAMES.filter((g) => g.streakFrom === undefined || g.streakFrom <= date);
  const played = new Map<string, Set<string>>();
  for (const r of rows) {
    if (!daily.has(r.game)) continue;
    const key = `${r.playerId}|${r.puzzleDate}`;
    (played.get(key) ?? played.set(key, new Set()).get(key)!).add(r.game);
  }
  const complete = (playerId: string, date: CivilDate) => {
    const games = played.get(`${playerId}|${date}`);
    return games !== undefined && required(date).every((g) => games.has(g.slug));
  };

  const result = new Map<string, number>();
  for (const playerId of new Set(rows.map((r) => r.playerId))) {
    let day =
      isWorkday(today) && complete(playerId, today) ? today : previousWorkday(today);
    let n = 0;
    while (complete(playerId, day)) {
      n += 1;
      day = previousWorkday(day);
    }
    if (n > 0) result.set(playerId, n);
  }
  return result;
}
