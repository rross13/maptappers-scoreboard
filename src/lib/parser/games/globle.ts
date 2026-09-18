import type { GameDefinition, GameParseResult } from "../types";
import { asCivil, civil, civilDateIn, daysBetween, monthFromName } from "../dates";
import { blockText, findLine, issue } from "./helpers";

const EARTH = "(?::earth_(?:americas|africa|asia):)";
const SQ =
  "(?::(?:large_(?:red|orange|yellow|green|blue|purple|brown)_square|white_large_square|black_large_square):)";

const ANCHOR_HEADER = /^Globle Stats$/m;
const ANCHOR_DATE = new RegExp(
  `^${EARTH}\\s*([A-Za-z]{3,9})\\.?\\s+(\\d{1,2}),\\s*(\\d{4})\\s*${EARTH}$`,
  "m",
);

/** The fire count is a streak and "Avg. Guesses" is a lifetime average.
 *  Neither is the score. Both are kept as detail so nobody mistakes them later. */
const STREAK = /^:fire:\s*(\d+)\s*\|\s*Avg\.\s*Guesses:\s*([\d.]+)$/;

/** The tile row wraps across lines when it is long; the "= N" lands on the last. */
const TILE_LINE = new RegExp(`^(${SQ}+)(?:\\s*=\\s*(\\d{1,3}))?$`);

export const globle: GameDefinition = {
  game: "globle",
  displayName: "Globle",
  anchors: [ANCHOR_HEADER, ANCHOR_DATE],
  /** "Globle Stats" and the date line are one apart when the header is present. */
  mergeWindow: 2,
  maxBlockLines: 10,
  priority: 50,

  parse(block, ctx): GameParseResult {
    const dateIdx = findLine(block, ANCHOR_DATE, 0, 3);
    if (dateIdx === -1) {
      return {
        ok: false,
        consumedLines: 1,
        issues: [
          issue("ambiguous-date", "error", "Found Globle but no date line.", {
            game: "globle",
            line: block.startLine,
          }),
        ],
      };
    }

    const m = ANCHOR_DATE.exec(block.lines[dateIdx])!;
    const month = monthFromName(m[1]);
    if (month === null) {
      return {
        ok: false,
        consumedLines: dateIdx + 1,
        issues: [
          issue("ambiguous-date", "error", `Unrecognized month "${m[1]}".`, {
            game: "globle",
            line: block.startLine + dateIdx,
          }),
        ],
      };
    }
    const puzzleDate = civil(Number(m[3]), month, Number(m[2]));
    const issues = [];

    let streak: number | undefined;
    let lifetimeAvgGuesses: number | undefined;
    let cursor = dateIdx + 1;
    const s = STREAK.exec(block.lines[cursor] ?? "");
    if (s) {
      streak = Number(s[1]);
      lifetimeAvgGuesses = Number(s[2]);
      cursor += 1;
    }

    // Accumulate consecutive tile lines, stopping at the one carrying "= N".
    const tiles: string[] = [];
    let score: number | null = null;
    let consumed = cursor;
    for (let i = cursor; i < Math.min(block.lines.length, cursor + 4); i++) {
      const t = TILE_LINE.exec(block.lines[i]);
      if (!t) break;
      tiles.push(...t[1].split(":").filter(Boolean));
      consumed = i + 1;
      if (t[2] !== undefined) {
        score = Number(t[2]);
        break;
      }
    }

    let scoreConfidence: "high" | "assumed" = "high";
    if (score === null) {
      if (tiles.length === 0) {
        return {
          ok: false,
          consumedLines: consumed,
          issues: [
            issue(
              "missing-score",
              "error",
              "Found a Globle header but no guess count.",
              { game: "globle", line: block.startLine },
            ),
          ],
        };
      }
      // Tile count equals the guess count on real data, including the wrapped
      // case, so it is a sound fallback for a truncated paste.
      score = tiles.length;
      scoreConfidence = "assumed";
    } else if (tiles.length !== score) {
      issues.push(
        issue(
          "tile-count-mismatch",
          "warning",
          `${tiles.length} tiles but the line says ${score} guesses. Using ${score}.`,
          { game: "globle", line: block.startLine + consumed - 1 },
        ),
      );
    }

    if (daysBetween(puzzleDate, civilDateIn(ctx.submittedAt, ctx.timeZone)) > 1) {
      issues.push(
        issue("future-date", "warning", "That date is in the future.", {
          game: "globle",
          line: block.startLine + dateIdx,
        }),
      );
    }

    return {
      ok: true,
      consumedLines: consumed,
      entry: {
        game: "globle",
        displayName: "Globle",
        score,
        scoreConfidence,
        puzzleDate: asCivil(puzzleDate),
        puzzleDateSource: "explicit",
        dateConfidence: "high",
        detail: { kind: "globle", tiles, streak, lifetimeAvgGuesses, freeform: false },
        issues,
        sourceText: blockText(block, consumed),
        sourceRange: [block.startLine, block.startLine + consumed],
      },
    };
  },
};
