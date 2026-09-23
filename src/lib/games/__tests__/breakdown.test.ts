import { describe, expect, it } from "vitest";
import { breakdownFor } from "../breakdown";
import { parsePaste, type GameDetail } from "@/lib/parser";
import { fixture, SUBMITTED_AT } from "@/lib/parser/__tests__/fixtures";

const detailOf = (file: string, game?: string): GameDetail => {
  const entries = parsePaste(fixture(file), { submittedAt: SUBMITTED_AT }).entries;
  return (game ? entries.find((e) => e.game === game)! : entries[0]).detail!;
};

describe("breakdownFor", () => {
  it("returns null without detail", () => {
    expect(breakdownFor(null, true)).toBeNull();
    expect(breakdownFor(undefined, false)).toBeNull();
  });

  describe("MapTap", () => {
    it("pairs each round with its emoji when the art is the player's own", () => {
      expect(breakdownFor(detailOf("maptap-mixed-round-emoji.txt"), true)?.lines).toEqual([
        "100🎯 97🔥 98🔥 80✨ 74😂",
      ]);
    });

    it("shows only the round numbers for historic rows", () => {
      expect(breakdownFor(detailOf("maptap-mixed-round-emoji.txt"), false)?.lines).toEqual([
        "100 · 97 · 98 · 80 · 74",
      ]);
    });

    it("passes through raw Unicode and unknown shortcodes", () => {
      const d: GameDetail = {
        kind: "maptap",
        rounds: [90, 80],
        roundEmoji: ["🦄", ":not_a_real_emoji:"],
      };
      expect(breakdownFor(d, true)?.lines).toEqual(["90🦄 80:not_a_real_emoji:"]);
    });

    it("is null when no rounds were read", () => {
      expect(breakdownFor({ kind: "maptap", rounds: [], roundEmoji: [] }, true)).toBeNull();
    });
  });

  describe("Krillion", () => {
    it("renders the tile row", () => {
      expect(breakdownFor(detailOf("krillion-mixed-tiles-unicode.txt"), true)?.lines).toEqual([
        "🫧🦑🐟🐟🐟🐟🐟",
      ]);
    });

    it("has nothing to show without art — tiles are its only detail", () => {
      expect(breakdownFor(detailOf("krillion-mixed-tiles-unicode.txt"), false)).toBeNull();
      expect(breakdownFor({ kind: "krillion", tiles: [], infinite: false }, true)).toBeNull();
    });
  });

  describe("Size It Up", () => {
    it("renders grid5 rows with each row's score", () => {
      const lines = breakdownFor(detailOf("sizeitup-grid5-with-row-scores.txt"), true)!.lines;
      expect(lines).toHaveLength(5);
      expect(lines[0]).toBe("🟥⬜⬜⬜⬜ 24");
      expect(lines[3]).toBe("🟥🟥🟥🟥🟥 100");
    });

    it("renders bar10 rows with no numbers", () => {
      const lines = breakdownFor(detailOf("sizeitup-bar10-no-row-scores.txt"), true)!.lines;
      expect(lines[0]).toBe("🟥🟥🟥🟥🟥🟥🟥🟥⬜⬜");
    });

    it("falls back to grid5 row scores for historic rows", () => {
      expect(
        breakdownFor(detailOf("sizeitup-grid5-with-row-scores.txt"), false)?.lines,
      ).toEqual(["24 · 56 · 0 · 100 · 82"]);
    });

    it("uses row scores for rows saved before the grid was captured", () => {
      const d: GameDetail = { kind: "size_it_up", variant: "grid5", rowScores: [1, 2] };
      expect(breakdownFor(d, true)?.lines).toEqual(["1 · 2"]);
    });

    it("is null for historic bar10 rows", () => {
      expect(breakdownFor(detailOf("sizeitup-bar10-no-row-scores.txt"), false)).toBeNull();
    });
  });

  describe("Globle", () => {
    it("never has a breakdown, tiled or typed", () => {
      expect(breakdownFor(detailOf("globle-wrapped-two-line-row.txt"), true)).toBeNull();
      expect(breakdownFor(detailOf("globle-with-stats-header.txt"), false)).toBeNull();
      expect(breakdownFor(detailOf("globle-freeform-in-9.txt"), true)).toBeNull();
    });
  });

  describe("Fermi", () => {
    it("lists rounds and the percentile, identically with or without art", () => {
      const d = detailOf("fermi-basic-3-rounds.txt");
      const expected = ["01  1.67×", "02  1.83×", "03  3.35×", "top 10%"];
      expect(breakdownFor(d, true)?.lines).toEqual(expected);
      expect(breakdownFor(d, false)?.lines).toEqual(expected);
    });

    it("keeps trailing zeros and prints integers bare", () => {
      const d: GameDetail = { kind: "fermi", rounds: [1.5, 122] };
      expect(breakdownFor(d, true)?.lines).toEqual(["01  1.50×", "02  122×"]);
    });
  });
});
