import { describe, expect, it } from "vitest";
import { streaks, type PlayDay } from "../streaks";
import { DAILY_GAMES, type GameSlug } from "@/lib/games/config";
import { asCivil } from "@/lib/parser/dates";

const TODAY = asCivil("2026-09-23");
const ALL = DAILY_GAMES.map((g) => g.slug);

function days(playerId: string, dates: string[], games: GameSlug[] = ALL): PlayDay[] {
  return dates.flatMap((puzzleDate) => games.map((game) => ({ playerId, game, puzzleDate })));
}

describe("streaks", () => {
  it("counts consecutive complete days ending today", () => {
    const r = streaks(days("a", ["2026-09-21", "2026-09-22", "2026-09-23"]), TODAY);
    expect(r.get("a")).toBe(3);
  });

  it("keeps a streak alive while today is still incomplete", () => {
    const rows = [
      ...days("a", ["2026-09-21", "2026-09-22"]),
      ...days("a", ["2026-09-23"], ["maptap", "globle"]),
    ];
    expect(streaks(rows, TODAY).get("a")).toBe(2);
  });

  it("ends at a missed day", () => {
    const rows = days("a", ["2026-09-19", "2026-09-20", "2026-09-22", "2026-09-23"]);
    expect(streaks(rows, TODAY).get("a")).toBe(2);
  });

  it("is gone once yesterday was missed", () => {
    const rows = days("a", ["2026-09-20", "2026-09-21"]);
    expect(streaks(rows, TODAY).has("a")).toBe(false);
  });

  it("needs all five games for a day to count", () => {
    const four = ALL.filter((g) => g !== "fermi");
    const rows = [
      ...days("a", ["2026-09-22", "2026-09-23"]),
      ...days("a", ["2026-09-21"], four),
      ...days("a", ["2026-09-20"]),
    ];
    expect(streaks(rows, TODAY).get("a")).toBe(2);
  });

  it("doesn't let Krillion ∞ stand in for a daily game", () => {
    const four = ALL.filter((g) => g !== "krillion");
    const rows = [
      ...days("a", ["2026-09-23"], four),
      { playerId: "a", game: "krillion_infinite" as const, puzzleDate: "2026-09-23" },
    ];
    expect(streaks(rows, TODAY).has("a")).toBe(false);
  });

  it("ignores duplicate rows and dates after today", () => {
    const rows = [
      ...days("a", ["2026-09-23", "2026-09-24"]),
      ...days("a", ["2026-09-23"]),
    ];
    expect(streaks(rows, TODAY).get("a")).toBe(1);
  });

  it("tracks each player separately", () => {
    const rows = [
      ...days("a", ["2026-09-22", "2026-09-23"]),
      ...days("b", ["2026-09-22"]),
      ...days("c", ["2026-09-23"], ["maptap"]),
    ];
    const r = streaks(rows, TODAY);
    expect(Object.fromEntries(r)).toEqual({ a: 2, b: 1 });
  });

  it("returns nothing for no rows", () => {
    expect(streaks([], TODAY).size).toBe(0);
  });
});
