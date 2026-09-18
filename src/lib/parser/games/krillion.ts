import type { Block, GameDefinition, GameParseResult } from "../types";
import { civilDateIn, dateFromPuzzleNumber, daysBetween } from "../dates";
import { blockText, issue } from "./helpers";

const TILE = "(?:fish|bubbles|squid|izakaya_lantern|star2|black_large_square)";
const TILE_ROW = new RegExp(`^(?::${TILE}:){5,9}$`);
const SCORE = /^(\d{1,4})$/;

/** The leading (?:^|\s) is what lets an anchor share its line with commentary,
 *  e.g. "that was horrible Krillion #62 :shrimp:". */
const ANCHOR_DAILY = /(?:^|\s)Krillion\s+#(\d+)\s*(?::shrimp:)?\s*$/m;
const ANCHOR_INFINITE =
  /(?:^|\s)Krillion\s*(?:∞|:infinity:)\s*#(\d+)\s*(?::shrimp:)?\s*$/m;

function parseKrillion(
  block: Block,
  ctx: Parameters<GameDefinition["parse"]>[1],
  infinite: boolean,
): GameParseResult {
  const puzzleNumber = Number(block.anchorMatch[1]);
  const game = infinite ? "krillion_infinite" : "krillion";
  const displayName = infinite ? "Krillion ∞" : "Krillion";

  // The score is the first bare-number line after the header. Krillion puts a
  // blank line between the score and the tile row, which is exactly why block
  // splitting cannot key on blank lines.
  let scoreIdx = -1;
  for (let i = 1; i < Math.min(block.lines.length, 4); i++) {
    if (SCORE.test(block.lines[i])) {
      scoreIdx = i;
      break;
    }
  }

  if (scoreIdx === -1) {
    return {
      ok: false,
      consumedLines: 1,
      issues: [
        issue(
          "missing-score",
          "error",
          `Found ${displayName} #${puzzleNumber} but no score line under it.`,
          { game, line: block.startLine },
        ),
      ],
    };
  }

  const score = Number(block.lines[scoreIdx]);
  const issues = [];

  let tiles: string[] = [];
  let consumed = scoreIdx + 1;
  for (let i = scoreIdx + 1; i < Math.min(block.lines.length, scoreIdx + 4); i++) {
    if (TILE_ROW.test(block.lines[i])) {
      tiles = block.lines[i].split(":").filter(Boolean);
      consumed = i + 1;
      break;
    }
  }

  // Infinite mode numbering is per-player and restarts at #1, so it maps to no
  // calendar date. It is stored against the submission day and never scored.
  let puzzleDate;
  let puzzleDateSource;
  if (infinite) {
    puzzleDate = civilDateIn(ctx.submittedAt, ctx.timeZone);
    puzzleDateSource = "submission-date" as const;
  } else {
    puzzleDate = dateFromPuzzleNumber("krillion", puzzleNumber);
    puzzleDateSource = "puzzle-number" as const;
    const ahead = daysBetween(puzzleDate, civilDateIn(ctx.submittedAt, ctx.timeZone));
    if (ahead > 2 || ahead < -1830) {
      issues.push(
        issue(
          "puzzle-number-out-of-range",
          "warning",
          `Krillion #${puzzleNumber} resolves to ${puzzleDate}, which looks wrong.`,
          { game, line: block.startLine },
        ),
      );
    }
  }

  return {
    ok: true,
    consumedLines: consumed,
    entry: {
      game,
      displayName,
      score,
      scoreConfidence: "high",
      puzzleDate,
      puzzleDateSource,
      dateConfidence: infinite ? "assumed" : "high",
      puzzleNumber,
      detail: { kind: "krillion", tiles, infinite },
      issues,
      sourceText: blockText(block, consumed),
      sourceRange: [block.startLine, block.startLine + consumed],
    },
  };
}

export const krillion: GameDefinition = {
  game: "krillion",
  displayName: "Krillion",
  anchors: [ANCHOR_DAILY],
  mergeWindow: 0,
  maxBlockLines: 6,
  priority: 50,
  parse: (block, ctx) => parseKrillion(block, ctx, false),
};

export const krillionInfinite: GameDefinition = {
  game: "krillion_infinite",
  displayName: "Krillion ∞",
  anchors: [ANCHOR_INFINITE],
  mergeWindow: 0,
  maxBlockLines: 6,
  // Higher than daily Krillion so the infinity variant wins when both could
  // match; in practice they are mutually exclusive since this one requires the
  // infinity sign, so this is only a tiebreak.
  priority: 60,
  parse: (block, ctx) => parseKrillion(block, ctx, true),
};
