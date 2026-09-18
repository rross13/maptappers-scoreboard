import type { GameDefinition, GameParseResult } from "../types";
import { civilDateIn, dateFromPuzzleNumber, daysBetween } from "../dates";
import { blockText, issue, parseNumber } from "./helpers";

const ANCHOR = /^Fermi\s*(?:[·•|–—-]\s*)?No\.\s*(\d+)$/m;
const ROUND = /^(\d{2})\s+([\d,]+(?:\.\d+)?)\s*[×x]$/;
const TOTAL =
  /^([\d,]+(?:\.\d+)?)\s*[×x]\s*score\s*[·•|]\s*top\s+(\d{1,3})%$/;
const TOTAL_LOOSE = /^([\d,]+(?:\.\d+)?)\s*[×x]\b.*?\btop\s+(\d{1,3})%/;

export const fermi: GameDefinition = {
  game: "fermi",
  displayName: "Fermi",
  anchors: [ANCHOR],
  mergeWindow: 0,
  maxBlockLines: 12,
  priority: 50,

  parse(block, ctx): GameParseResult {
    const puzzleNumber = Number(block.anchorMatch[1]);
    const rounds: number[] = [];
    let score: number | null = null;
    let percentile: number | undefined;
    let consumed = 1;

    for (let i = 1; i < block.lines.length; i++) {
      const line = block.lines[i];
      const r = ROUND.exec(line);
      if (r) {
        rounds.push(parseNumber(r[2]));
        consumed = i + 1;
        continue;
      }
      const t = TOTAL.exec(line) ?? TOTAL_LOOSE.exec(line);
      if (t) {
        score = parseNumber(t[1]);
        percentile = Number(t[2]);
        consumed = i + 1;
        break;
      }
      // The horizontal rule between rounds and total, plus blanks and the URL.
      if (line === "" || /^[─━—–_-]{3,}$/.test(line)) {
        consumed = i + 1;
        continue;
      }
      if (/fermi\.gg/.test(line)) {
        consumed = i + 1;
        continue;
      }
      break;
    }

    if (score === null) {
      return {
        ok: false,
        consumedLines: consumed,
        issues: [
          issue(
            "missing-score",
            "error",
            `Found Fermi No. ${puzzleNumber} but no score line.`,
            { game: "fermi", line: block.startLine },
          ),
        ],
      };
    }

    const issues = [];
    if (rounds.length !== 3) {
      issues.push(
        issue(
          "row-count-mismatch",
          "warning",
          `Expected 3 rounds, found ${rounds.length}.`,
          { game: "fermi", line: block.startLine },
        ),
      );
    }

    // The multiplier is bounded below by 1 by construction, so a value at or
    // below zero means a parser bug — and it would blow up the log transform.
    if (!(score > 0)) {
      return {
        ok: false,
        consumedLines: consumed,
        issues: [
          issue(
            "score-out-of-range",
            "error",
            `Fermi multipliers are positive; got ${score}.`,
            { game: "fermi", line: block.startLine },
          ),
        ],
      };
    }

    const puzzleDate = dateFromPuzzleNumber("fermi", puzzleNumber);
    const ahead = daysBetween(puzzleDate, civilDateIn(ctx.submittedAt, ctx.timeZone));
    if (ahead > 2 || ahead < -1830) {
      issues.push(
        issue(
          "puzzle-number-out-of-range",
          "warning",
          `Fermi No. ${puzzleNumber} resolves to ${puzzleDate}, which looks wrong.`,
          { game: "fermi", line: block.startLine },
        ),
      );
    }

    return {
      ok: true,
      consumedLines: consumed,
      entry: {
        game: "fermi",
        displayName: "Fermi",
        score,
        scoreConfidence: "high",
        puzzleDate,
        puzzleDateSource: "puzzle-number",
        dateConfidence: "high",
        puzzleNumber,
        // The percentile is stored but is never the score. Lower % and lower
        // multiplier both mean "better", which makes them easy to conflate.
        detail: { kind: "fermi", rounds, percentile },
        issues,
        sourceText: blockText(block, consumed),
        sourceRange: [block.startLine, block.startLine + consumed],
      },
    };
  },
};
