import { describe, expect, it } from "vitest";
import { parsePaste } from "..";
import { fixture, fixtureNames, SUBMITTED_AT } from "./fixtures";

const parse = (name: string) =>
  parsePaste(fixture(name), { submittedAt: SUBMITTED_AT });

describe("MapTap", () => {
  it("parses the Slack shortcode form", () => {
    const r = parse("maptap-slack-shortcodes.txt");
    expect(r.status).toBe("ok");
    expect(r.entries).toHaveLength(1);
    const e = r.entries[0];
    expect(e.game).toBe("maptap");
    expect(e.score).toBe(872);
    expect(e.puzzleDate).toBe("2026-09-18");
    expect(e.puzzleDateSource).toBe("inferred-year");
    expect(e.detail).toMatchObject({ kind: "maptap", rounds: [99, 80, 93, 80, 89] });
  });

  it("parses raw Unicode emoji identically", () => {
    const a = parse("maptap-slack-shortcodes.txt").entries[0];
    const b = parse("maptap-unicode-emoji.txt").entries[0];
    expect(b.score).toBe(a.score);
    expect(b.detail).toEqual(a.detail);
  });

  it("handles Slack's <url|label> syntax", () => {
    const r = parse("maptap-slack-linkified.txt");
    expect(r.entries[0].score).toBe(872);
  });

  it("ignores commentary above the block", () => {
    const r = parse("maptap-leading-commentary.txt");
    expect(r.entries).toHaveLength(1);
    expect(r.entries[0].score).toBe(780);
    expect(r.entries[0].puzzleDate).toBe("2026-09-15");
  });

  it("reports a missing final score line", () => {
    const r = parse("maptap-missing-final-score.txt");
    expect(r.entries).toHaveLength(0);
    expect(r.failures[0].issues[0].code).toBe("missing-score");
  });
});

describe("Krillion", () => {
  it("parses the daily puzzle and derives its date from the number", () => {
    const e = parse("krillion-daily-shortcodes.txt").entries[0];
    expect(e.game).toBe("krillion");
    expect(e.score).toBe(185);
    expect(e.puzzleNumber).toBe(65);
    expect(e.puzzleDate).toBe("2026-09-18");
    expect(e.puzzleDateSource).toBe("puzzle-number");
  });

  it("parses Unicode tiles identically", () => {
    const a = parse("krillion-daily-shortcodes.txt").entries[0];
    const b = parse("krillion-daily-unicode.txt").entries[0];
    expect(b.score).toBe(a.score);
    expect(b.detail).toEqual(a.detail);
  });

  it("survives commentary sharing the anchor's line", () => {
    const e = parse("krillion-inline-commentary.txt").entries[0];
    expect(e.score).toBe(180);
    expect(e.puzzleNumber).toBe(62);
    expect(e.puzzleDate).toBe("2026-09-15");
  });

  it("treats infinite mode as its own non-daily game", () => {
    const e = parse("krillion-infinite.txt").entries[0];
    expect(e.game).toBe("krillion_infinite");
    expect(e.score).toBe(290);
    // #1 of a per-player run maps to no calendar date.
    expect(e.puzzleDateSource).toBe("submission-date");
  });
});

describe("Size It Up", () => {
  it("parses the newer 5-square layout and validates the row sum", () => {
    const e = parse("sizeitup-grid5-with-row-scores.txt").entries[0];
    expect(e.score).toBe(262);
    expect(e.detail).toMatchObject({
      kind: "size_it_up",
      variant: "grid5",
      rowScores: [24, 56, 0, 100, 82],
    });
    expect(e.issues).toHaveLength(0);
  });

  it("keeps each grid5 row's squares for the breakdown", () => {
    const e = parse("sizeitup-grid5-with-row-scores.txt").entries[0];
    const grid = e.detail?.kind === "size_it_up" ? e.detail.grid : undefined;
    expect(grid).toHaveLength(5);
    expect(grid![1]).toEqual([
      "large_red_square",
      "large_red_square",
      "large_red_square",
      "white_large_square",
      "white_large_square",
    ]);
  });

  it("parses the older 10-square bar layout without summing rows", () => {
    const e = parse("sizeitup-bar10-no-row-scores.txt").entries[0];
    expect(e.score).toBe(335);
    expect(e.detail).toMatchObject({ kind: "size_it_up", variant: "bar10" });
    const grid = e.detail?.kind === "size_it_up" ? e.detail.grid : undefined;
    expect(grid?.map((row) => row.length)).toEqual([10, 10, 10, 10, 10]);
    expect(grid?.map((row) => row.filter((t) => t === "large_red_square").length))
      .toEqual([8, 9, 6, 6, 4]);
    // The bars are a rounded rendering, not data — no sum check may fire.
    expect(e.issues.map((i) => i.code)).not.toContain("row-sum-mismatch");
  });

  it("warns but still parses when rows disagree with the overall", () => {
    const e = parse("sizeitup-row-sum-mismatch.txt").entries[0];
    expect(e.score).toBe(999);
    expect(e.issues.map((i) => i.code)).toContain("row-sum-mismatch");
  });

  it("falls back to the submission day when pasted alone", () => {
    const e = parse("sizeitup-grid5-with-row-scores.txt").entries[0];
    expect(e.puzzleDateSource).toBe("submission-date");
    expect(e.dateConfidence).toBe("assumed");
    expect(e.puzzleDate).toBe("2026-09-18");
  });
});

describe("Globle", () => {
  it("parses with the stats header", () => {
    const e = parse("globle-with-stats-header.txt").entries[0];
    expect(e.score).toBe(5);
    expect(e.puzzleDate).toBe("2026-09-18");
    expect(e.puzzleDateSource).toBe("explicit");
  });

  it("parses without the header", () => {
    const e = parse("globle-no-header.txt").entries[0];
    expect(e.score).toBe(6);
    expect(e.puzzleDate).toBe("2026-09-15");
  });

  it("handles a tile row wrapped across two lines", () => {
    const e = parse("globle-wrapped-two-line-row.txt").entries[0];
    expect(e.score).toBe(9);
    expect(e.detail).toMatchObject({ kind: "globle", freeform: false });
    if (e.detail?.kind === "globle") expect(e.detail.tiles).toHaveLength(9);
  });

  it("never mistakes the streak or the lifetime average for the score", () => {
    const e = parse("globle-with-stats-header.txt").entries[0];
    expect(e.score).toBe(5);
    expect(e.score).not.toBe(9.38);
    if (e.detail?.kind === "globle") {
      expect(e.detail.streak).toBe(5);
      expect(e.detail.lifetimeAvgGuesses).toBe(9.38);
    }
  });

  it("parses Unicode emoji identically", () => {
    const e = parse("globle-unicode-emoji.txt").entries[0];
    expect(e.score).toBe(5);
    expect(e.puzzleDate).toBe("2026-09-18");
  });
});

describe("Globle freeform", () => {
  it("reads a typed score at low confidence", () => {
    const e = parse("globle-freeform-in-9.txt").entries[0];
    expect(e.game).toBe("globle");
    expect(e.score).toBe(9);
    expect(e.scoreConfidence).toBe("low");
    expect(e.detail).toMatchObject({ freeform: true });
  });

  it("reads the 'N guesses' phrasing", () => {
    expect(parse("globle-freeform-20-guesses.txt").entries[0].score).toBe(20);
  });

  it("tolerates the recurring 'Globe' typo", () => {
    expect(parse("globle-freeform-globe-typo.txt").entries[0].score).toBe(9);
  });

  it("rejects a puzzle number posing as a score", () => {
    const r = parse("globle-freeform-rejected-puzzle-number.txt");
    expect(r.entries).toHaveLength(0);
  });
});

describe("Fermi", () => {
  it("parses rounds, score and percentile", () => {
    const e = parse("fermi-basic-3-rounds.txt").entries[0];
    expect(e.score).toBeCloseTo(2.28);
    expect(e.puzzleNumber).toBe(53);
    expect(e.puzzleDate).toBe("2026-09-17");
    expect(e.detail).toMatchObject({
      kind: "fermi",
      rounds: [1.67, 1.83, 3.35],
      percentile: 10,
    });
  });

  it("parses comma-separated multipliers", () => {
    const e = parse("fermi-comma-separated-huge.txt").entries[0];
    expect(e.score).toBe(349);
    if (e.detail?.kind === "fermi") expect(e.detail.rounds).toContain(266667);
  });

  it("reports a missing total line", () => {
    const r = parse("fermi-missing-total-line.txt");
    expect(r.entries).toHaveLength(0);
    expect(r.failures[0].issues[0].code).toBe("missing-score");
  });
});

describe("multi-game pastes", () => {
  it("parses all five games from one blob", () => {
    const r = parse("multi-all-five-games.txt");
    expect(r.entries.map((e) => e.game).sort()).toEqual([
      "fermi",
      "globle",
      "krillion",
      "maptap",
      "size_it_up",
    ]);
    const by = Object.fromEntries(r.entries.map((e) => [e.game, e]));
    expect(by.maptap.score).toBe(592);
    expect(by.globle.score).toBe(9);
    expect(by.krillion.score).toBe(170);
    expect(by.fermi.score).toBeCloseTo(3.63);
    expect(by.size_it_up.score).toBe(296);
  });

  it("dates Size It Up from a sibling game rather than today", () => {
    const r = parse("multi-all-five-games.txt");
    const siu = r.entries.find((e) => e.game === "size_it_up")!;
    expect(siu.puzzleDate).toBe("2026-09-16");
    expect(siu.puzzleDateSource).toBe("sibling-inference");
    expect(siu.dateConfidence).toBe("high");
  });
});

describe("junk and robustness", () => {
  it("returns empty for pure commentary", () => {
    const r = parse("junk-pure-commentary.txt");
    expect(r.status).toBe("empty");
    expect(r.entries).toHaveLength(0);
  });

  it("does not turn talking about a game into a score", () => {
    const r = parse("junk-mentions-game-name-only.txt");
    expect(r.entries).toHaveLength(0);
    // Prose before the anchor softens it to unrecognized rather than an error.
    expect(r.failures).toHaveLength(0);
  });

  it("handles an empty paste", () => {
    const r = parsePaste("", { submittedAt: SUBMITTED_AT });
    expect(r.status).toBe("empty");
  });

  it("never throws on any truncation of any fixture", () => {
    for (const name of fixtureNames()) {
      const lines = fixture(name).split("\n");
      for (let k = 0; k <= lines.length; k++) {
        const input = lines.slice(0, k).join("\n");
        expect(() =>
          parsePaste(input, { submittedAt: SUBMITTED_AT }),
        ).not.toThrow();
      }
    }
  });

  it("handles CRLF and non-breaking spaces", () => {
    const crlf = fixture("maptap-slack-shortcodes.txt").replace(/\n/g, "\r\n");
    expect(parsePaste(crlf, { submittedAt: SUBMITTED_AT }).entries[0].score).toBe(872);
    const nbsp = fixture("krillion-daily-shortcodes.txt").replace(/ /g, " ");
    expect(parsePaste(nbsp, { submittedAt: SUBMITTED_AT }).entries[0].score).toBe(185);
  });
});
