/**
 * Single source of truth for game identity and scoring semantics.
 *
 * This lives in TypeScript rather than a database table because the scoring code
 * branches on `direction` and `transform` — putting it here means code review and
 * unit tests reach it. The Postgres enum is generated from GAME_SLUGS so the two
 * cannot drift; `config.test.ts` asserts they agree.
 */

export const GAME_SLUGS = [
  "maptap",
  "krillion",
  "size_it_up",
  "globle",
  "fermi",
  "krillion_infinite",
] as const;

export type GameSlug = (typeof GAME_SLUGS)[number];

/** Applied before z-scoring. See `scoring/z.ts`. */
export type Transform = "identity" | "log10";

export type Accent = "blue" | "purple" | "yellow" | "coral" | "mono";

export interface GameConfig {
  slug: GameSlug;
  name: string;
  /** 1 = higher score is better, -1 = lower score is better. */
  direction: 1 | -1;
  transform: Transform;
  /** Decimal places for display. */
  precision: number;
  suffix?: string;
  min?: number;
  max?: number;
  /** Number of per-round subscores the share text carries, if any. */
  rounds?: number;
  accent: Accent;
  /** Whether this game counts toward the daily leaderboards. */
  isDaily: boolean;
}

export const GAMES: Record<GameSlug, GameConfig> = {
  maptap: {
    slug: "maptap",
    name: "MapTap",
    direction: 1,
    transform: "identity",
    precision: 0,
    min: 0,
    max: 1000,
    rounds: 5,
    accent: "blue",
    isDaily: true,
  },
  krillion: {
    slug: "krillion",
    name: "Krillion",
    direction: 1,
    transform: "identity",
    precision: 0,
    min: 0,
    accent: "purple",
    isDaily: true,
  },
  size_it_up: {
    slug: "size_it_up",
    name: "Size It Up",
    direction: 1,
    transform: "identity",
    precision: 0,
    min: 0,
    max: 500,
    rounds: 5,
    accent: "yellow",
    isDaily: true,
  },
  globle: {
    slug: "globle",
    name: "Globle",
    direction: -1,
    transform: "identity",
    precision: 0,
    min: 1,
    accent: "coral",
    isDaily: true,
  },
  fermi: {
    slug: "fermi",
    name: "Fermi",
    direction: -1,
    // Observed range is 1.25x to 349x. On a raw scale one huge outlier compresses
    // every real performance into an indistinguishable clump; log10 spreads them
    // back out. z-scores are invariant to log base, so the base is for readability.
    transform: "log10",
    precision: 2,
    suffix: "×",
    min: 1,
    accent: "mono",
    isDaily: true,
  },
  krillion_infinite: {
    slug: "krillion_infinite",
    name: "Krillion ∞",
    direction: 1,
    transform: "identity",
    precision: 0,
    min: 0,
    accent: "purple",
    // Practice mode. Its #N is per-player and maps to no calendar date, so it is
    // stored but never scored against a daily group.
    isDaily: false,
  },
};

/** The five games that appear on leaderboards, in canonical display order. */
export const DAILY_GAMES: GameConfig[] = GAME_SLUGS.map((s) => GAMES[s]).filter(
  (g) => g.isDaily,
);

export function isGameSlug(value: string): value is GameSlug {
  return (GAME_SLUGS as readonly string[]).includes(value);
}
