import type { Block, ParseIssue, IssueCode } from "../types";

export function issue(
  code: IssueCode,
  severity: "error" | "warning",
  message: string,
  extra: Partial<ParseIssue> = {},
): ParseIssue {
  return { code, severity, message, ...extra };
}

/** Numbers in share text carry thousands separators: "4,656x", "266,667x". */
export function parseNumber(s: string): number {
  return parseFloat(s.replace(/,/g, ""));
}

/** Index of the first line at or after `from` matching `re`, else -1. */
export function findLine(
  block: Block,
  re: RegExp,
  from = 0,
  limit = Infinity,
): number {
  const end = Math.min(block.lines.length, from + limit);
  for (let i = from; i < end; i++) {
    if (re.test(block.lines[i])) return i;
  }
  return -1;
}

export function blockText(block: Block, consumed: number): string {
  return block.lines.slice(0, consumed).join("\n").trim();
}
