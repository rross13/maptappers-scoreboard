import { describe, expect, it } from "vitest";
import { DAILY_GAMES, GAMES, GAME_SLUGS, formatScore, isGameSlug } from "../config";
import { parseCivil } from "@/lib/parser/dates";

describe("game config", () => {
  /** The Postgres enum is generated from GAME_SLUGS, so drift here is a bug. */
  it("keeps GAMES keyed by exactly GAME_SLUGS", () => {
    expect(Object.keys(GAMES).sort()).toEqual([...GAME_SLUGS].sort());
    for (const slug of GAME_SLUGS) expect(GAMES[slug].slug).toBe(slug);
  });

  it("uses unique display names", () => {
    const names = GAME_SLUGS.map((s) => GAMES[s].name);
    expect(new Set(names).size).toBe(names.length);
  });

  it("marks exactly the two lower-is-better games", () => {
    const lower = GAME_SLUGS.filter((s) => GAMES[s].direction === -1);
    expect(lower.sort()).toEqual(["fermi", "globle"]);
  });

  it("log-transforms only Fermi", () => {
    const logged = GAME_SLUGS.filter((s) => GAMES[s].transform === "log10");
    expect(logged).toEqual(["fermi"]);
  });

  it("exposes the six daily games", () => {
    expect(DAILY_GAMES.map((g) => g.slug)).toEqual([
      "maptap", "krillion", "size_it_up", "globle", "fermi", "daily_tens",
    ]);
  });

  /** Four brand accents can't cover six games. DailyTens sharing MapTap's blue
   *  is the one deliberate overlap; any other is a mistake. */
  it("assigns distinct accents apart from DailyTens sharing MapTap's", () => {
    expect(GAMES.daily_tens.accent).toBe(GAMES.maptap.accent);
    const accents = DAILY_GAMES.filter((g) => g.slug !== "daily_tens").map((g) => g.accent);
    expect(new Set(accents).size).toBe(accents.length);
  });

  it("formats DailyTens out of ten", () => {
    expect(formatScore("daily_tens", 6)).toBe("6/10");
  });

  /** A malformed date compares wrongly as a string and silently changes streaks. */
  it("gives streakFrom as a real YYYY-MM-DD", () => {
    for (const g of DAILY_GAMES) {
      if (g.streakFrom !== undefined) expect(parseCivil(g.streakFrom)).toBe(g.streakFrom);
    }
    expect(GAMES.daily_tens.streakFrom).toBe("2026-11-14");
  });

  /** Every URL here is copied out of a real share text; a typo sends the team
   *  to the wrong site, and nothing else would catch it. */
  it("gives every linked game an absolute https URL", () => {
    for (const slug of GAME_SLUGS) {
      const url = GAMES[slug].url;
      if (url === undefined) continue;
      expect(() => new URL(url)).not.toThrow();
      expect(new URL(url).protocol).toBe("https:");
    }
  });

  it("narrows unknown slugs", () => {
    expect(isGameSlug("maptap")).toBe(true);
    expect(isGameSlug("wordle")).toBe(false);
  });
});
