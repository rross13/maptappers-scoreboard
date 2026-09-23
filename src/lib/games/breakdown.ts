import type { GameDetail } from "@/lib/parser/types";
import { emojify } from "@/lib/parser/emoji";

export interface Breakdown {
  lines: string[];
}

const tile = (t: string) => emojify(`:${t}:`);
const tileRow = (tiles: string[]) => tiles.map(tile).join("");

/** Fermi prints "122×" and "1.50×"; String() alone would turn the latter into "1.5×". */
const multiplier = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2)) + "×";

/**
 * What a score's hover shows, or null when there is nothing beyond the score.
 *
 * `withArt` is false for rows with no raw paste: the backfill's tile art was
 * regenerated, so only the numbers in those rows are the player's own. Fermi
 * has no art, so it reads the same either way.
 */
export function breakdownFor(
  detail: GameDetail | null | undefined,
  withArt: boolean,
): Breakdown | null {
  if (!detail) return null;
  const lines: string[] = [];

  switch (detail.kind) {
    case "maptap":
      if (detail.rounds.length === 0) return null;
      lines.push(
        withArt
          ? detail.rounds.map((r, i) => `${r}${emojify(detail.roundEmoji[i] ?? "")}`).join(" ")
          : detail.rounds.join(" · "),
      );
      break;

    case "krillion":
      if (withArt && detail.tiles.length > 0) lines.push(tileRow(detail.tiles));
      break;

    case "size_it_up": {
      const grid = withArt ? (detail.grid ?? []) : [];
      if (grid.length > 0) {
        grid.forEach((row, i) => {
          const n = detail.rowScores?.[i];
          lines.push(n === undefined ? tileRow(row) : `${tileRow(row)} ${n}`);
        });
      } else if (detail.rowScores?.length) {
        lines.push(detail.rowScores.join(" · "));
      }
      break;
    }

    case "globle":
      if (withArt && detail.tiles.length > 0) lines.push(tileRow(detail.tiles));
      if (detail.streak !== undefined) {
        lines.push(
          detail.lifetimeAvgGuesses === undefined
            ? `Streak ${detail.streak}`
            : `Streak ${detail.streak} · avg ${detail.lifetimeAvgGuesses} guesses`,
        );
      }
      break;

    case "fermi":
      detail.rounds.forEach((r, i) => {
        lines.push(`${String(i + 1).padStart(2, "0")}  ${multiplier(r)}`);
      });
      if (detail.percentile !== undefined) lines.push(`top ${detail.percentile}%`);
      break;
  }

  return lines.length > 0 ? { lines } : null;
}
