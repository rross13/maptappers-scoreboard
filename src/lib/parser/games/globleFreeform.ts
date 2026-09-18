import type { GameDefinition, GameParseResult } from "../types";
import { civilDateIn } from "../dates";
import { issue } from "./helpers";

/**
 * Second-pass matcher for typed Globle scores.
 *
 * About half the Globle results in the team's history were never shared in the
 * structured format; people just type "Globle in 9". Refusing those would mean a
 * human retypes the number by hand anyway, so they are matched here — but always
 * at low confidence and never auto-saved. `globl?e` covers the recurring "Globe"
 * typo.
 */
const FREEFORM = /\bglobl?e\b[^\d\n]{0,24}?(\d{1,2})\b/i;

/** Rejects "Globle #20" — that is a puzzle number, not a guess count. */
const PUZZLE_NUMBER = /\bglobl?e\b\s*#/i;

export const globleFreeform: GameDefinition = {
  game: "globle",
  displayName: "Globle",
  anchors: [FREEFORM],
  mergeWindow: 0,
  maxBlockLines: 1,
  priority: -10,
  secondPass: true,

  parse(block, ctx): GameParseResult {
    const line = block.lines[0] ?? "";

    if (PUZZLE_NUMBER.test(line)) {
      return {
        ok: false,
        consumedLines: 1,
        issues: [
          issue(
            "low-confidence-freeform",
            "error",
            "That looks like a Globle puzzle number, not a guess count.",
            { game: "globle", line: block.startLine },
          ),
        ],
      };
    }

    const m = FREEFORM.exec(line);
    const guesses = m ? Number(m[1]) : NaN;

    // A plausible Globle takes between 1 and 30 guesses; anything else is a
    // number that happened to sit near the word.
    if (!Number.isFinite(guesses) || guesses < 1 || guesses > 30) {
      return {
        ok: false,
        consumedLines: 1,
        issues: [
          issue(
            "low-confidence-freeform",
            "error",
            "Mentions Globle but no plausible guess count.",
            { game: "globle", line: block.startLine },
          ),
        ],
      };
    }

    return {
      ok: true,
      consumedLines: 1,
      entry: {
        game: "globle",
        displayName: "Globle",
        score: guesses,
        scoreConfidence: "low",
        puzzleDate: civilDateIn(ctx.submittedAt, ctx.timeZone),
        puzzleDateSource: "submission-date",
        dateConfidence: "assumed",
        detail: { kind: "globle", tiles: [], freeform: true },
        issues: [
          issue(
            "low-confidence-freeform",
            "warning",
            `Read this as Globle in ${guesses} guesses — confirm before saving.`,
            { game: "globle", line: block.startLine, excerpt: line },
          ),
        ],
        sourceText: line,
        sourceRange: [block.startLine, block.startLine + 1],
      },
    };
  },
};
