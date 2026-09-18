import type { GameSlug } from "@/lib/games/config";

/** 'YYYY-MM-DD'. Branded so a raw string cannot be passed where a civil date is
 *  expected — date bugs here are silent and expensive. */
export type CivilDate = string & { readonly __civil: unique symbol };

export type DateSource =
  | "explicit" // Globle prints a full date
  | "inferred-year" // MapTap prints month + day only
  | "puzzle-number" // Krillion, Fermi
  | "sibling-inference" // Size It Up, borrowed from another game in the paste
  | "submission-date"; // Size It Up, last resort

export type Confidence = "high" | "assumed" | "low";

export type IssueCode =
  | "no-games-found"
  | "missing-score"
  | "ambiguous-date"
  | "score-out-of-range"
  | "row-count-mismatch"
  | "row-sum-mismatch"
  | "tile-count-mismatch"
  | "puzzle-number-out-of-range"
  | "future-date"
  | "unsupported-variant"
  | "duplicate-game-in-paste"
  | "low-confidence-freeform";

export interface ParseIssue {
  code: IssueCode;
  severity: "error" | "warning";
  message: string;
  game?: GameSlug;
  /** 0-based index into the ORIGINAL lines, which normalization preserves. */
  line?: number;
  excerpt?: string;
}

export type GameDetail =
  | { kind: "maptap"; rounds: number[]; roundEmoji: string[] }
  | { kind: "krillion"; tiles: string[]; infinite: boolean }
  | {
      kind: "size_it_up";
      variant: "grid5" | "bar10";
      rowScores?: number[];
    }
  | {
      kind: "globle";
      tiles: string[];
      streak?: number;
      lifetimeAvgGuesses?: number;
      freeform: boolean;
    }
  | { kind: "fermi"; rounds: number[]; percentile?: number };

export interface ParsedEntry {
  game: GameSlug;
  displayName: string;
  score: number;
  scoreConfidence: Confidence;
  puzzleDate: CivilDate;
  puzzleDateSource: DateSource;
  dateConfidence: Confidence;
  puzzleNumber?: number;
  detail?: GameDetail;
  /** Warnings only. Anything that would be an error produces a FailedBlock. */
  issues: ParseIssue[];
  sourceText: string;
  sourceRange: [start: number, end: number];
}

export interface FailedBlock {
  game: GameSlug;
  displayName: string;
  issues: ParseIssue[];
  sourceText: string;
  sourceRange: [start: number, end: number];
}

export interface UnrecognizedSpan {
  text: string;
  sourceRange: [start: number, end: number];
  /** Only spans that look like an attempted score get surfaced to the user;
   *  ordinary chatter stays silent. */
  looksLikeGame: boolean;
}

export interface ParseResult {
  status: "ok" | "partial" | "empty";
  entries: ParsedEntry[];
  failures: FailedBlock[];
  unrecognized: UnrecognizedSpan[];
  normalizedText: string;
}

export interface ParseContext {
  submittedAt: Date;
  timeZone: string;
  submissionDay: CivilDate;
  /** Whether to run the low-confidence freeform Globle matcher. */
  allowFreeform: boolean;
}

export interface Block {
  game: GameSlug;
  lines: string[];
  text: string;
  startLine: number;
  endLine: number;
  /** True when the anchor had prose before it on its line. Used to downgrade a
   *  score-less match to "unrecognized" instead of nagging with an error. */
  anchorHasPrefix: boolean;
  anchorMatch: RegExpMatchArray;
}

export type GameParseResult =
  | { ok: true; entry: ParsedEntry; consumedLines: number }
  | { ok: false; issues: ParseIssue[]; consumedLines: number };

export interface GameDefinition {
  game: GameSlug;
  displayName: string;
  /** Signature lines. Declared with `m`, never `g` — the splitter clones them. */
  anchors: RegExp[];
  /** Two anchors of the same game within this many lines collapse to the first. */
  mergeWindow: number;
  maxBlockLines: number;
  /** Higher wins when two different games anchor on the same line. */
  priority: number;
  /** Runs only over spans no first-pass game claimed. */
  secondPass?: boolean;
  parse(block: Block, ctx: ParseContext): GameParseResult;
}
