import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const DIR = join(__dirname, "..", "__fixtures__");

/** Fixtures are real .txt files so exact bytes survive — trailing whitespace,
 *  raw Unicode emoji and CRLF are the things under test and escaping them into
 *  a .ts literal would mangle them. */
export function fixture(name: string): string {
  return readFileSync(join(DIR, name), "utf8");
}

export function fixtureNames(): string[] {
  return readdirSync(DIR).filter((f) => f.endsWith(".txt"));
}

/** Fixed clock so year inference and submission-day fallbacks are deterministic. */
export const SUBMITTED_AT = new Date("2026-09-18T16:30:00Z");
