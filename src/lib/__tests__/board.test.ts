import { describe, expect, it } from "vitest";
import { bestScores, dayColumns, gameColumns, type DayRow, type GameStandingRow } from "../board";
import { parseSort, sortRows } from "../sort";

const day: DayRow[] = [
  { name: "Ana", streak: 1, scores: { maptap: 800, globle: 9 } },
  { name: "Ben", streak: 4, scores: { maptap: 950 } },
  { name: "Cat", streak: undefined, scores: { maptap: 700, globle: 3 } },
  { name: "Dan", streak: 2, scores: { globle: 12 } },
];

function sortDay(raw: string) {
  const cols = dayColumns<DayRow>();
  const state = parseSort(raw, cols.map((c) => c.key), "player");
  return sortRows(day, cols.find((c) => c.key === state.key)!, state).map((r) => r.name);
}

describe("day board columns", () => {
  it("offers player, streak and every daily game", () => {
    expect(dayColumns().map((c) => c.key)).toEqual([
      "player", "streak", "maptap", "krillion", "size_it_up", "globle", "fermi",
    ]);
  });

  it("puts the best score first where higher is better", () => {
    expect(sortDay("maptap")).toEqual(["Ben", "Ana", "Cat", "Dan"]);
  });

  it("puts the best score first where lower is better, with no-shows last", () => {
    expect(sortDay("globle")).toEqual(["Cat", "Ana", "Dan", "Ben"]);
    expect(sortDay("-globle")).toEqual(["Dan", "Ana", "Cat", "Ben"]);
  });

  it("ranks streaks longest-first and treats sub-badge streaks as none", () => {
    expect(sortDay("streak")).toEqual(["Ben", "Dan", "Ana", "Cat"]);
  });

  it("sorts names A→Z, and Z→A reversed", () => {
    expect(sortDay("player")).toEqual(["Ana", "Ben", "Cat", "Dan"]);
    expect(sortDay("-player")).toEqual(["Dan", "Cat", "Ben", "Ana"]);
  });
});

describe("day's best scores", () => {
  it("takes the highest where higher is better and the lowest where lower is", () => {
    const best = bestScores(day);
    expect(best.maptap).toBe(950);
    expect(best.globle).toBe(3);
  });

  it("awards nothing for a game only one player logged", () => {
    const rows: DayRow[] = [
      { name: "Ana", streak: undefined, scores: { fermi: 2.5, krillion: 40 } },
      { name: "Ben", streak: undefined, scores: { krillion: 55 } },
    ];
    expect(bestScores(rows).fermi).toBeUndefined();
    expect(bestScores(rows).krillion).toBe(55);
  });

  it("awards nothing for a game nobody logged", () => {
    expect(bestScores(day).size_it_up).toBeUndefined();
  });

  it("returns the shared value on a tie, so every tied player matches it", () => {
    const rows: DayRow[] = [
      { name: "Ana", streak: undefined, scores: { fermi: 1.5 } },
      { name: "Ben", streak: undefined, scores: { fermi: 1.5 } },
      { name: "Cat", streak: undefined, scores: { fermi: 4 } },
    ];
    expect(bestScores(rows).fermi).toBe(1.5);
  });
});

describe("game standings columns", () => {
  const rows: GameStandingRow[] = [
    { name: "Ana", avgZ: 0.5, avgRaw: 1.8, best: 1.25, entries: 3 },
    { name: "Ben", avgZ: null, avgRaw: 1.4, best: 1.4, entries: 1 },
    { name: "Cat", avgZ: -0.5, avgRaw: 2.6, best: 1.1, entries: 5 },
  ];
  const sortBy = (game: "fermi" | "maptap", key: string) => {
    const col = gameColumns<GameStandingRow>(game).find((c) => c.key === key)!;
    return sortRows(rows, col, { key, reversed: false }).map((r) => r.name);
  };

  it("sorts by z with unscored players last", () => {
    expect(sortBy("fermi", "z")).toEqual(["Ana", "Cat", "Ben"]);
  });

  it("treats the lowest average and best as best on a lower-is-better game", () => {
    expect(sortBy("fermi", "avg")).toEqual(["Ben", "Ana", "Cat"]);
    expect(sortBy("fermi", "best")).toEqual(["Cat", "Ana", "Ben"]);
  });

  it("treats the highest as best on a higher-is-better game", () => {
    expect(sortBy("maptap", "avg")).toEqual(["Cat", "Ana", "Ben"]);
  });

  it("sorts played most-first", () => {
    expect(sortBy("maptap", "played")).toEqual(["Cat", "Ana", "Ben"]);
  });
});
