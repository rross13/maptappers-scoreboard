import type { Block, GameDefinition, GameParseResult } from "../types";
import { civilDateIn, dateFromPuzzleNumber, daysBetween } from "../dates";
import { blockText, issue } from "./helpers";

/** A top-10 list: one cell per answer, laid out 5 rows of 2. */
const CELLS = 10;
const CELL = /:(trophy|x):/g;
const GRID_ROW = /^(?::(?:trophy|x):\s*)+$/;

const ANCHOR = /(?:^|\s)DailyTens\s*#(\d+)\s*$/m;

type DailyTensCell = "trophy" | "x";

function parseDailyTens(
  block: Block,
  ctx: Parameters<GameDefinition["parse"]>[1],
): GameParseResult {
  const puzzleNumber = Number(block.anchorMatch[1]);

  // Rows are read until the first line that is neither a grid row nor blank, so a
  // trailing URL or comment ends the grid rather than being counted into it.
  const grid: DailyTensCell[][] = [];
  let consumed = 1;
  for (let i = 1; i < block.lines.length; i++) {
    const line = block.lines[i];
    if (GRID_ROW.test(line)) {
      grid.push([...line.matchAll(CELL)].map((m) => m[1] as DailyTensCell));
      consumed = i + 1;
    } else if (line !== "" || grid.length > 0) {
      break;
    }
  }

  const cells = grid.flat();
  if (cells.length === 0) {
    return {
      ok: false,
      consumedLines: 1,
      issues: [
        issue(
          "missing-score",
          "error",
          `Found DailyTens #${puzzleNumber} but no grid of 🏆/❌ under it.`,
          { game: "daily_tens", line: block.startLine },
        ),
      ],
    };
  }
  // A short grid would silently score its missing cells as misses.
  if (cells.length !== CELLS) {
    return {
      ok: false,
      consumedLines: consumed,
      issues: [
        issue(
          "tile-count-mismatch",
          "error",
          `DailyTens #${puzzleNumber} shows ${cells.length} answers, expected ${CELLS}. Paste the whole grid.`,
          { game: "daily_tens", line: block.startLine },
        ),
      ],
    };
  }

  const puzzleDate = dateFromPuzzleNumber("daily_tens", puzzleNumber);
  const issues = [];
  const ahead = daysBetween(puzzleDate, civilDateIn(ctx.submittedAt, ctx.timeZone));
  if (ahead > 2 || ahead < -1830) {
    issues.push(
      issue(
        "puzzle-number-out-of-range",
        "warning",
        `DailyTens #${puzzleNumber} resolves to ${puzzleDate}, which looks wrong.`,
        { game: "daily_tens", line: block.startLine },
      ),
    );
  }

  return {
    ok: true,
    consumedLines: consumed,
    entry: {
      game: "daily_tens",
      displayName: "DailyTens",
      score: cells.filter((c) => c === "trophy").length,
      scoreConfidence: "high",
      puzzleDate,
      puzzleDateSource: "puzzle-number",
      dateConfidence: "high",
      puzzleNumber,
      detail: { kind: "daily_tens", grid },
      issues,
      sourceText: blockText(block, consumed),
      sourceRange: [block.startLine, block.startLine + consumed],
    },
  };
}

export const dailyTens: GameDefinition = {
  game: "daily_tens",
  displayName: "DailyTens",
  anchors: [ANCHOR],
  mergeWindow: 0,
  // Header, blank, five rows, blank, URL — plus slack for a wrapped row.
  maxBlockLines: 12,
  priority: 50,
  parse: parseDailyTens,
};
