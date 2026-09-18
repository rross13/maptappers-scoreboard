import type { GameDefinition, GameParseResult } from "../types";
import { civilDateIn, inferYear, monthFromName } from "../dates";
import { blockText, findLine, issue } from "./helpers";

const ANCHOR =
  /(?:^|\s)(?:www\.)?maptap\.gg\s+([A-Za-z]{3,9})\.?\s+(\d{1,2})(?:,\s*(\d{4}))?\s*$/m;

/** A round marker is a number followed by either a shortcode or any emoji.
 *  Matching any pictograph rather than a fixed list matters: MapTap's per-round
 *  emoji vary with the score band and the set is open-ended. */
const ROUND =
  /(\d{1,3})\s*(?::([a-z0-9_+-]+):|(\p{Extended_Pictographic}️?(?:‍\p{Extended_Pictographic}️?)*))/gu;

const FINAL = /^Final score:\s*(\d{1,4})\s*$/m;

export const maptap: GameDefinition = {
  game: "maptap",
  displayName: "MapTap",
  anchors: [ANCHOR],
  mergeWindow: 0,
  maxBlockLines: 6,
  priority: 50,

  parse(block, ctx): GameParseResult {
    const [, monthName, dayStr, yearStr] = block.anchorMatch;
    const month = monthFromName(monthName);
    const day = Number(dayStr);

    const finalIdx = findLine(block, FINAL, 0, 5);
    if (finalIdx === -1) {
      return {
        ok: false,
        consumedLines: 1,
        issues: [
          issue(
            "missing-score",
            "error",
            "Found a MapTap header but no “Final score:” line.",
            { game: "maptap", line: block.startLine },
          ),
        ],
      };
    }

    const score = Number(FINAL.exec(block.lines[finalIdx])![1]);
    const issues = [];

    if (month === null) {
      return {
        ok: false,
        consumedLines: finalIdx + 1,
        issues: [
          issue("ambiguous-date", "error", `Unrecognized month "${monthName}".`, {
            game: "maptap",
            line: block.startLine,
          }),
        ],
      };
    }

    const reference = civilDateIn(ctx.submittedAt, ctx.timeZone);
    let puzzleDate;
    let future = false;
    if (yearStr) {
      puzzleDate = inferYear(month, day, reference).date;
      puzzleDate = `${yearStr}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}` as typeof puzzleDate;
    } else {
      const inferred = inferYear(month, day, reference);
      puzzleDate = inferred.date;
      future = inferred.future;
    }
    if (future) {
      issues.push(
        issue("future-date", "warning", `That date is in the future.`, {
          game: "maptap",
          line: block.startLine,
        }),
      );
    }

    if (score < 0 || score > 1000) {
      issues.push(
        issue(
          "score-out-of-range",
          "warning",
          `MapTap scores run 0–1000; got ${score}.`,
          { game: "maptap", line: block.startLine + finalIdx },
        ),
      );
    }

    // Round subscores are recorded but never cross-validated against the final:
    // they do not sum to it by any fitted relation (99+80+93+80+89=441 vs 872),
    // and the gap widens as rounds drop. The "Final score:" line is authoritative.
    const rounds: number[] = [];
    const roundEmoji: string[] = [];
    for (let i = 1; i < finalIdx; i++) {
      const line = block.lines[i];
      ROUND.lastIndex = 0;
      const matches = [...line.matchAll(ROUND)];
      if (matches.length >= 3) {
        for (const m of matches) {
          rounds.push(Number(m[1]));
          roundEmoji.push(m[2] ? `:${m[2]}:` : m[3]);
        }
        break;
      }
    }

    if (rounds.length > 0 && rounds.length !== 5) {
      issues.push(
        issue(
          "row-count-mismatch",
          "warning",
          `Expected 5 rounds, found ${rounds.length}.`,
          { game: "maptap", line: block.startLine },
        ),
      );
    }

    return {
      ok: true,
      consumedLines: finalIdx + 1,
      entry: {
        game: "maptap",
        displayName: "MapTap",
        score,
        scoreConfidence: "high",
        puzzleDate,
        puzzleDateSource: yearStr ? "explicit" : "inferred-year",
        dateConfidence: "high",
        detail: { kind: "maptap", rounds, roundEmoji },
        issues,
        sourceText: blockText(block, finalIdx + 1),
        sourceRange: [block.startLine, block.startLine + finalIdx + 1],
      },
    };
  },
};
