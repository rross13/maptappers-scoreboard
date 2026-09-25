import { describe, expect, it } from "vitest";
import { isDescending, nextSort, parseSort, sortParam, sortRows, type SortColumn } from "../sort";

type Row = { name: string; score: number | null };
const rows: Row[] = [
  { name: "bea", score: 3 },
  { name: "Al", score: null },
  { name: "cy", score: 7 },
  { name: "dee", score: 3 },
];
const byName: SortColumn<Row> = { key: "name", value: (r) => r.name, descending: false };
const byScore: SortColumn<Row> = { key: "score", value: (r) => r.score, descending: true };
const names = (rs: Row[]) => rs.map((r) => r.name);

describe("parseSort", () => {
  const keys = ["name", "score"];

  it("reads a plain and a reversed key", () => {
    expect(parseSort("score", keys, "name")).toEqual({ key: "score", reversed: false });
    expect(parseSort("-score", keys, "name")).toEqual({ key: "score", reversed: true });
  });

  it("falls back on a missing or unknown key", () => {
    expect(parseSort(undefined, keys, "name")).toEqual({ key: "name", reversed: false });
    expect(parseSort("-bogus", keys, "name")).toEqual({ key: "name", reversed: false });
    expect(parseSort("-", keys, "name")).toEqual({ key: "name", reversed: false });
  });

  it("round-trips through sortParam", () => {
    for (const raw of ["score", "-score", "name", "-name"]) {
      expect(sortParam(parseSort(raw, keys, "name"))).toBe(raw);
    }
  });
});

describe("nextSort", () => {
  it("reverses the active column", () => {
    expect(nextSort({ key: "score", reversed: false }, "score").reversed).toBe(true);
    expect(nextSort({ key: "score", reversed: true }, "score").reversed).toBe(false);
  });

  it("starts a different column in its natural order", () => {
    expect(nextSort({ key: "score", reversed: true }, "name")).toEqual({
      key: "name",
      reversed: false,
    });
  });
});

describe("sortRows", () => {
  it("sorts strings case-insensitively in natural order", () => {
    expect(names(sortRows(rows, byName, { key: "name", reversed: false }))).toEqual([
      "Al", "bea", "cy", "dee",
    ]);
  });

  it("sorts numbers largest-first when the column says so, keeping ties stable", () => {
    expect(names(sortRows(rows, byScore, { key: "score", reversed: false }))).toEqual([
      "cy", "bea", "dee", "Al",
    ]);
  });

  it("keeps missing values last when reversed", () => {
    expect(names(sortRows(rows, byScore, { key: "score", reversed: true }))).toEqual([
      "bea", "dee", "cy", "Al",
    ]);
  });

  it("does not mutate its input", () => {
    const copy = [...rows];
    sortRows(rows, byScore, { key: "score", reversed: false });
    expect(rows).toEqual(copy);
  });

  it("reports the effective direction for aria-sort", () => {
    expect(isDescending(byScore, { key: "score", reversed: false })).toBe(true);
    expect(isDescending(byScore, { key: "score", reversed: true })).toBe(false);
    expect(isDescending(byName, { key: "name", reversed: true })).toBe(true);
  });
});
