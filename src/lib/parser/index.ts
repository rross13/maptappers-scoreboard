import { normalizeLines } from "./normalize";
import { splitIntoBlocks, defForBlock } from "./blocks";
import { FIRST_PASS, SECOND_PASS } from "./registry";
import { SCOREBOARD_TZ, civilDateIn } from "./dates";
import type {
  Block,
  CivilDate,
  FailedBlock,
  ParseContext,
  ParsedEntry,
  ParseResult,
  UnrecognizedSpan,
} from "./types";

export * from "./types";
export { normalize } from "./normalize";
export { SCOREBOARD_TZ } from "./dates";

export const PARSER_VERSION = 1;

export interface ParseOptions {
  submittedAt?: Date;
  timeZone?: string;
  allowFreeform?: boolean;
}

function buildContext(opts: ParseOptions = {}): ParseContext {
  const submittedAt = opts.submittedAt ?? new Date();
  const timeZone = opts.timeZone ?? SCOREBOARD_TZ;
  return {
    submittedAt,
    timeZone,
    submissionDay: civilDateIn(submittedAt, timeZone),
    allowFreeform: opts.allowFreeform ?? true,
  };
}

/** Contiguous runs of lines no parser claimed. */
function unclaimedSpans(
  lines: string[],
  claimed: boolean[],
): { start: number; end: number }[] {
  const spans: { start: number; end: number }[] = [];
  let start: number | null = null;
  for (let i = 0; i <= lines.length; i++) {
    const isFree = i < lines.length && !claimed[i];
    if (isFree && start === null) start = i;
    if (!isFree && start !== null) {
      spans.push({ start, end: i });
      start = null;
    }
  }
  return spans;
}

/** Surfaces only spans that look like an attempted score; chatter stays silent. */
function looksLikeGame(text: string): boolean {
  const shortcodes = (text.match(/:[a-z0-9_+-]+:/g) ?? []).length;
  const digitLines = text
    .split("\n")
    .filter((l) => /\d/.test(l) && l.trim() !== "").length;
  return shortcodes >= 3 || digitLines >= 2;
}

/**
 * Size It Up prints neither a date nor a puzzle number. Most real pastes carry
 * several games at once, so the date of a confidently-dated sibling is a far
 * better guess than the submission day.
 */
function resolveSiblingDates(
  entries: ParsedEntry[],
  ctx: ParseContext,
): void {
  const needsDate = entries.filter((e) => e.puzzleDate === "");
  if (needsDate.length === 0) return;

  const confident = [
    ...new Set(
      entries
        .filter((e) => e.dateConfidence === "high" && e.puzzleDate !== "")
        .map((e) => e.puzzleDate),
    ),
  ];

  for (const entry of needsDate) {
    if (confident.length === 1) {
      entry.puzzleDate = confident[0] as CivilDate;
      entry.puzzleDateSource = "sibling-inference";
      entry.dateConfidence = "high";
      continue;
    }
    entry.puzzleDate = ctx.submissionDay;
    entry.puzzleDateSource = "submission-date";
    entry.dateConfidence = "assumed";
    if (confident.length > 1) {
      entry.issues.push({
        code: "ambiguous-date",
        severity: "warning",
        message: `Other games in this paste disagree on the date (${confident.join(", ")}), so today was assumed.`,
        game: entry.game,
      });
    }
  }
}

export function parsePaste(raw: string, opts: ParseOptions = {}): ParseResult {
  const ctx = buildContext(opts);
  const { normalized } = normalizeLines(raw);
  const normalizedText = normalized.join("\n");

  const entries: ParsedEntry[] = [];
  const failures: FailedBlock[] = [];
  const claimed = new Array(normalized.length).fill(false);

  const runBlock = (block: Block, defs = FIRST_PASS) => {
    const def = defForBlock(block, defs);
    let result;
    try {
      result = def.parse(block, ctx);
    } catch (err) {
      // A parser must never take the whole paste down with it.
      result = {
        ok: false as const,
        consumedLines: 1,
        issues: [
          {
            code: "unsupported-variant" as const,
            severity: "error" as const,
            message: `Could not read this ${def.displayName} block: ${
              err instanceof Error ? err.message : String(err)
            }`,
            game: def.game,
            line: block.startLine,
          },
        ],
      };
    }

    const consumed = Math.max(1, Math.min(result.consumedLines, block.lines.length));
    for (let i = block.startLine; i < block.startLine + consumed; i++) {
      claimed[i] = true;
    }

    if (result.ok) {
      entries.push(result.entry);
      return;
    }

    // An anchor with prose in front of it that yields no score is far more
    // likely to be someone talking about a game than a malformed share, so it
    // is released rather than reported as an error.
    if (block.anchorHasPrefix) {
      for (let i = block.startLine; i < block.startLine + consumed; i++) {
        claimed[i] = false;
      }
      return;
    }

    failures.push({
      game: def.game,
      displayName: def.displayName,
      issues: result.issues,
      sourceText: block.text,
      sourceRange: [block.startLine, block.endLine],
    });
  };

  for (const block of splitIntoBlocks(normalized, FIRST_PASS)) {
    runBlock(block);
  }

  // Second pass runs only over what nothing else claimed.
  const unrecognized: UnrecognizedSpan[] = [];
  const hasStructuredGloble = entries.some(
    (e) => e.game === "globle" && e.detail?.kind === "globle" && !e.detail.freeform,
  );

  for (const span of unclaimedSpans(normalized, claimed)) {
    let matchedHere = false;

    if (ctx.allowFreeform && !hasStructuredGloble) {
      for (let i = span.start; i < span.end; i++) {
        const line = normalized[i];
        for (const def of SECOND_PASS) {
          if (!def.anchors.some((re) => re.test(line))) continue;
          runBlock(
            {
              game: def.game,
              lines: [line],
              text: line,
              startLine: i,
              endLine: i + 1,
              anchorHasPrefix: false,
              anchorMatch: def.anchors[0].exec(line)!,
            },
            SECOND_PASS,
          );
          matchedHere = true;
          break;
        }
      }
    }

    if (matchedHere) continue;

    const text = normalized.slice(span.start, span.end).join("\n").trim();
    if (text === "") continue;
    unrecognized.push({
      text,
      sourceRange: [span.start, span.end],
      looksLikeGame: looksLikeGame(text),
    });
  }

  resolveSiblingDates(entries, ctx);

  // Same game twice on the same date in one paste: keep the first, flag it.
  const seen = new Set<string>();
  const deduped: ParsedEntry[] = [];
  for (const e of entries) {
    const key = `${e.game}|${e.puzzleDate}`;
    if (seen.has(key)) {
      deduped[deduped.length - 1]?.issues.push({
        code: "duplicate-game-in-paste",
        severity: "warning",
        message: `This paste had more than one ${e.displayName} result for ${e.puzzleDate}; the first was kept.`,
        game: e.game,
      });
      continue;
    }
    seen.add(key);
    deduped.push(e);
  }

  const status: ParseResult["status"] =
    deduped.length === 0 ? "empty" : failures.length > 0 ? "partial" : "ok";

  return { status, entries: deduped, failures, unrecognized, normalizedText };
}

export function summarize(result: ParseResult): {
  recognized: string[];
  problems: string[];
  ignored: number;
} {
  return {
    recognized: result.entries.map(
      (e) => `${e.displayName} — ${e.score} (${e.puzzleDate})`,
    ),
    problems: result.failures.flatMap((f) =>
      f.issues
        .filter((i) => i.severity === "error")
        .map((i) => `${f.displayName}: ${i.message}`),
    ),
    ignored: result.unrecognized.filter((u) => u.looksLikeGame).length,
  };
}
