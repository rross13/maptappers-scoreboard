import { GAMES, type GameSlug } from "@/lib/games/config";

/**
 * Daily z-scoring.
 *
 * Each (game, puzzle date) is a "slot": everyone who played that game that day
 * is compared against each other, never against a global average. That is what
 * makes a hard day and an easy day worth the same.
 */

/** Below this, a slot has no group to normalize against and is not scored. */
export const MIN_PARTICIPANTS = 2;

export function transform(game: GameSlug, raw: number): number {
  const cfg = GAMES[game];
  if (cfg.transform === "log10") {
    if (!(raw > 0)) {
      throw new Error(
        `log10 transform needs a positive score; got ${raw} for ${game}`,
      );
    }
    return Math.log10(raw);
  }
  return raw;
}

export function mean(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

/** Sample standard deviation (n-1). Null when there are fewer than 2 values. */
export function sampleStdev(xs: number[]): number | null {
  const n = xs.length;
  if (n < 2) return null;
  const m = mean(xs);
  const ss = xs.reduce((acc, x) => acc + (x - m) ** 2, 0);
  return Math.sqrt(ss / (n - 1));
}

export interface DailyEntry {
  playerId: string;
  rawScore: number;
}

export interface ScoredEntry extends DailyEntry {
  /** The transformed value the z was computed from. */
  value: number;
  z: number;
}

/**
 * Scores one slot.
 *
 * Returns null when the slot is unscoreable. Returns z = 0 for everyone when the
 * group tied — that is a real outcome that must still count as participation,
 * and it is the case a naive NULLIF(stddev, 0) silently drops.
 */
export function scoreSlot(
  game: GameSlug,
  entries: DailyEntry[],
): ScoredEntry[] | null {
  if (entries.length < MIN_PARTICIPANTS) return null;

  const { direction } = GAMES[game];
  const values = entries.map((e) => transform(game, e.rawScore));
  const mu = mean(values);
  const sd = sampleStdev(values)!;

  return entries.map((e, i) => ({
    ...e,
    value: values[i],
    // The direction flip is what makes positive z mean "beat the group" on
    // every game, including the two where a lower raw score is better.
    z: sd === 0 ? 0 : direction * ((values[i] - mu) / sd),
  }));
}
