import { describe, expect, it } from "vitest";
import { streaks, type PlayDay } from "../streaks";
import { DAILY_GAMES, type GameSlug } from "@/lib/games/config";
import { asCivil } from "@/lib/parser/dates";

const TODAY = asCivil("2026-09-23");
const ALL = DAILY_GAMES.map((g) => g.slug);
/** What a complete day looked like before DailyTens joined on 2026-11-14. */
const ORIGINAL_FIVE = ALL.filter((g) => g !== "daily_tens");

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

  it("needs every daily game for a day to count", () => {
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

  describe("a game joining partway through", () => {
    const today = asCivil("2026-11-15");

    it("doesn't require DailyTens on days before it joined", () => {
      const rows = [
        ...days("a", ["2026-11-12", "2026-11-13"], ORIGINAL_FIVE),
        ...days("a", ["2026-11-14", "2026-11-15"]),
      ];
      expect(streaks(rows, today).get("a")).toBe(4);
    });

    it("keeps today's streak alive on the switch-over, counting the old days", () => {
      const rows = days("a", ["2026-11-11", "2026-11-12", "2026-11-13"], ORIGINAL_FIVE);
      expect(streaks(rows, asCivil("2026-11-14")).get("a")).toBe(3);
    });

    it("requires DailyTens from 2026-11-14 on", () => {
      const rows = [
        ...days("a", ["2026-11-13"], ORIGINAL_FIVE),
        ...days("a", ["2026-11-14"], ORIGINAL_FIVE),
        ...days("a", ["2026-11-15"]),
      ];
      expect(streaks(rows, today).get("a")).toBe(1);
    });
  });

  it("returns nothing for no rows", () => {
    expect(streaks([], TODAY).size).toBe(0);
  });
});
