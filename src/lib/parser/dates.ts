import type { CivilDate } from "./types";

/**
 * Civil-date arithmetic.
 *
 * Everything routes through UTC-noon Date objects. A local-midnight Date lands
 * exactly on DST boundaries and produces off-by-one dates twice a year; noon has
 * 12 hours of slack in either direction.
 */

export const SCOREBOARD_TZ = "America/Denver";

const MONTHS = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
];

export function asCivil(s: string): CivilDate {
  return s as CivilDate;
}

export function civil(year: number, month: number, day: number): CivilDate {
  const mm = String(month).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return asCivil(`${year}-${mm}-${dd}`);
}

function toUtcNoon(d: CivilDate): Date {
  const [y, m, day] = d.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, day, 12, 0, 0));
}

export function addDays(d: CivilDate, n: number): CivilDate {
  const dt = toUtcNoon(d);
  dt.setUTCDate(dt.getUTCDate() + n);
  return civil(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
}

/** A strict YYYY-MM-DD that names a real day, or null. For untrusted input
 *  such as a query string; `asCivil` trusts its argument. */
export function parseCivil(s: string | undefined): CivilDate | null {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = asCivil(s);
  // Date.UTC rolls 2026-02-30 over into March, so a round trip catches it.
  return addDays(d, 0) === d ? d : null;
}

/** Positive when `a` is after `b`. */
export function daysBetween(a: CivilDate, b: CivilDate): number {
  return Math.round(
    (toUtcNoon(a).getTime() - toUtcNoon(b).getTime()) / 86_400_000,
  );
}

/** The civil date of an instant in a given timezone. */
export function civilDateIn(instant: Date, timeZone: string): CivilDate {
  // en-CA formats as YYYY-MM-DD.
  const s = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(instant);
  return asCivil(s);
}

/** Month name or abbreviation, with or without a trailing period. */
export function monthFromName(name: string): number | null {
  const key = name.toLowerCase().replace(/\.$/, "");
  if (key.length < 3) return null;
  const idx = MONTHS.findIndex((m) => m.startsWith(key));
  return idx === -1 ? null : idx + 1;
}

/**
 * Verified daily-puzzle anchors.
 *
 * Two pairs per game are kept on purpose: `assertEpochsConsistent` cross-checks
 * them, so a typo in one constant fails a test rather than silently shifting
 * every historical date. Both sets were confirmed against every observed post
 * in the Slack history (Krillion across 9 points, Fermi across 4).
 */
export const PUZZLE_EPOCHS = {
  krillion: [
    { number: 56, date: asCivil("2026-09-09") },
    { number: 65, date: asCivil("2026-09-18") },
  ],
  fermi: [
    { number: 50, date: asCivil("2026-09-14") },
    { number: 53, date: asCivil("2026-09-17") },
  ],
} as const;

export type EpochGame = keyof typeof PUZZLE_EPOCHS;

export function assertEpochsConsistent(): void {
  for (const [game, pairs] of Object.entries(PUZZLE_EPOCHS)) {
    const [a, b] = pairs;
    const expected = addDays(a.date, b.number - a.number);
    if (expected !== b.date) {
      throw new Error(
        `${game} puzzle epochs disagree: #${a.number}=${a.date} implies #${b.number}=${expected}, but the second anchor says ${b.date}`,
      );
    }
  }
}

export function dateFromPuzzleNumber(
  game: EpochGame,
  puzzleNumber: number,
): CivilDate {
  const [anchor] = PUZZLE_EPOCHS[game];
  return addDays(anchor.date, puzzleNumber - anchor.number);
}

/**
 * MapTap prints a month and day with no year. Picks the candidate year whose
 * date lies closest to the submission day, which handles the December/January
 * boundary in both directions.
 */
export function inferYear(
  month: number,
  day: number,
  reference: CivilDate,
): { date: CivilDate; future: boolean } {
  const refYear = Number(reference.slice(0, 4));
  const candidates = [refYear - 1, refYear, refYear + 1].map((y) =>
    civil(y, month, day),
  );
  let best = candidates[0];
  let bestDist = Math.abs(daysBetween(best, reference));
  for (const c of candidates.slice(1)) {
    const dist = Math.abs(daysBetween(c, reference));
    if (dist < bestDist) {
      best = c;
      bestDist = dist;
    }
  }
  // One day of tolerance: people paste late at night across a date boundary.
  return { date: best, future: daysBetween(best, reference) > 1 };
}
