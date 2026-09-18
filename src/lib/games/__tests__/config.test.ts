import { describe, expect, it } from "vitest";
import { DAILY_GAMES, GAMES, GAME_SLUGS, isGameSlug } from "../config";

describe("game config", () => {
  /** The Postgres enum is generated from GAME_SLUGS, so drift here is a bug. */
  it("keeps GAMES keyed by exactly GAME_SLUGS", () => {
    expect(Object.keys(GAMES).sort()).toEqual([...GAME_SLUGS].sort());
    for (const slug of GAME_SLUGS) expect(GAMES[slug].slug).toBe(slug);
  });

  it("uses unique display names and codes", () => {
    const names = GAME_SLUGS.map((s) => GAMES[s].name);
    const codes = GAME_SLUGS.map((s) => GAMES[s].code);
    expect(new Set(names).size).toBe(names.length);
    expect(new Set(codes).size).toBe(codes.length);
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

  it("narrows unknown slugs", () => {
    expect(isGameSlug("maptap")).toBe(true);
    expect(isGameSlug("wordle")).toBe(false);
  });
});
