import { describe, expect, it } from "vitest";
import { DAILY_GAMES, GAMES, GAME_SLUGS, isGameSlug } from "../config";

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

  it("exposes the five daily games", () => {
    expect(DAILY_GAMES.map((g) => g.slug)).toEqual([
      "maptap", "krillion", "size_it_up", "globle", "fermi",
    ]);
  });

  it("assigns each daily game a distinct accent", () => {
    const accents = DAILY_GAMES.map((g) => g.accent);
    expect(new Set(accents).size).toBe(accents.length);
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
