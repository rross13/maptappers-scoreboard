import type { GameDefinition, GameParseResult } from "../types";
import { blockText, findLine, issue } from "./helpers";

const SQ = "(?::(?:large_red_square|white_large_square):)";
const ANCHOR_TITLE = /^Size It Up$/m;
const ANCHOR_SCORE = /^Overall Score\s+(\d{1,3})$/m;

/** Newer layout: five squares then the row's own score. */
const ROW_GRID5 = new RegExp(`^(${SQ}{5})\\s+(\\d{1,3})$`);
/** Older layout: a ten-square bar, no number. */
const ROW_BAR10 = new RegExp(`^(${SQ}{10})$`);

export const sizeItUp: GameDefinition = {
  game: "size_it_up",
  displayName: "Size It Up",
  anchors: [ANCHOR_TITLE, ANCHOR_SCORE],
  /** Title and "Overall Score" are separate anchors a line apart; collapse them. */
  mergeWindow: 3,
  maxBlockLines: 12,
  priority: 50,

  parse(block): GameParseResult {
    const scoreIdx = findLine(block, ANCHOR_SCORE, 0, 4);
    if (scoreIdx === -1) {
      return {
        ok: false,
        consumedLines: 1,
        issues: [
          issue(
            "missing-score",
            "error",
            "Found Size It Up but no “Overall Score” line.",
            { game: "size_it_up", line: block.startLine },
          ),
        ],
      };
    }

    const overall = Number(ANCHOR_SCORE.exec(block.lines[scoreIdx])![1]);
    const issues = [];

    const rowScores: number[] = [];
    let variant: "grid5" | "bar10" | null = null;
    let consumed = scoreIdx + 1;

    for (let i = scoreIdx + 1; i < block.lines.length; i++) {
      const line = block.lines[i];
      const g5 = ROW_GRID5.exec(line);
      if (g5) {
        variant ??= "grid5";
        if (variant === "grid5") {
          rowScores.push(Number(g5[2]));
          consumed = i + 1;
          continue;
        }
      }
      if (ROW_BAR10.test(line)) {
        variant ??= "bar10";
        if (variant === "bar10") {
          consumed = i + 1;
          continue;
        }
      }
      if (line === "") continue;
      if (/magnitudle\.com/.test(line)) {
        consumed = i + 1;
        continue;
      }
      break;
    }

    const rowCount = variant === "grid5" ? rowScores.length : null;
    if (variant === "grid5" && rowCount !== 5) {
      issues.push(
        issue(
          "row-count-mismatch",
          "warning",
          `Expected 5 rows, found ${rowCount}.`,
          { game: "size_it_up", line: block.startLine },
        ),
      );
    }

    // Only the newer layout carries real per-row numbers, and there the rows do
    // sum to the overall (verified on real data). The older ten-square bars are
    // a rounded rendering, not the underlying values, so they are never summed.
    if (variant === "grid5" && rowScores.length === 5) {
      const sum = rowScores.reduce((a, b) => a + b, 0);
      if (sum !== overall) {
        issues.push(
          issue(
            "row-sum-mismatch",
            "warning",
            `Row scores sum to ${sum} but the overall says ${overall}. Using ${overall}.`,
            { game: "size_it_up", line: block.startLine + scoreIdx },
          ),
        );
      }
    }

    if (overall < 0 || overall > 500) {
      issues.push(
        issue(
          "score-out-of-range",
          "warning",
          `Size It Up runs 0–500; got ${overall}.`,
          { game: "size_it_up", line: block.startLine + scoreIdx },
        ),
      );
    }

    return {
      ok: true,
      consumedLines: consumed,
      entry: {
        game: "size_it_up",
        displayName: "Size It Up",
        score: overall,
        scoreConfidence: "high",
        // Size It Up prints no date and no puzzle number. The pipeline fills
        // this in from a sibling game in the same paste when it can, and falls
        // back to the submission day; both are marked assumed until then.
        puzzleDate: "" as never,
        puzzleDateSource: "submission-date",
        dateConfidence: "assumed",
        detail: {
          kind: "size_it_up",
          variant: variant ?? "grid5",
          rowScores: variant === "grid5" ? rowScores : undefined,
        },
        issues,
        sourceText: blockText(block, consumed),
        sourceRange: [block.startLine, block.startLine + consumed],
      },
    };
  },
};
