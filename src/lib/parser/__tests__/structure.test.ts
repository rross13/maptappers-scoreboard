import { describe, expect, it } from "vitest";
import { normalize } from "../normalize";
import { GAME_REGISTRY, FIRST_PASS } from "../registry";
import {
  addDays,
  assertEpochsConsistent,
  civilDateIn,
  dateFromPuzzleNumber,
  daysBetween,
  inferYear,
  asCivil,
  monthFromName,
  parseCivil,
} from "../dates";
import { parsePaste } from "..";
import { fixture, SUBMITTED_AT } from "./fixtures";

describe("normalize", () => {
  /** One assertion per game proves the whole emoji layer in both directions. */
  it.each([
    ["maptap", "maptap-slack-shortcodes.txt", "maptap-unicode-emoji.txt"],
    ["krillion", "krillion-daily-shortcodes.txt", "krillion-daily-unicode.txt"],
  ])("%s normalizes identically from Unicode and shortcodes", (_g, a, b) => {
    expect(normalize(fixture(b))).toBe(normalize(fixture(a)));
  });

  it("preserves line count", () => {
    for (const name of [
      "multi-all-five-games.txt",
      "globle-wrapped-two-line-row.txt",
    ]) {
      const raw = fixture(name).replace(/\r\n|\r/g, "\n");
      expect(normalize(raw).split("\n")).toHaveLength(raw.split("\n").length);
    }
  });

  it("unwraps Slack links, preferring the label", () => {
    expect(normalize("<http://www.maptap.gg|www.maptap.gg> September 18")).toBe(
      "www.maptap.gg September 18",
    );
    expect(normalize("<https://globle-game.com>")).toBe("https://globle-game.com");
  });

  it("does not manufacture a link out of escaped angle brackets", () => {
    // Decoding entities before de-linkifying would turn this into "y".
    expect(normalize("&lt;http://x|y&gt;")).toBe("<http://x|y>");
  });
});

describe("registry", () => {
  it("declares anchors with m and never g", () => {
    for (const def of GAME_REGISTRY) {
      for (const re of def.anchors) {
        expect(re.global, `${def.game} anchor must not be global`).toBe(false);
      }
    }
  });

  /** Guards against a future game's anchor quietly stealing another's blocks. */
  it("matches each game fixture only with its own parser", () => {
    const cases: Record<string, string> = {
      maptap: "maptap-slack-shortcodes.txt",
      krillion: "krillion-daily-shortcodes.txt",
      size_it_up: "sizeitup-grid5-with-row-scores.txt",
      globle: "globle-with-stats-header.txt",
      fermi: "fermi-basic-3-rounds.txt",
    };
    for (const [game, file] of Object.entries(cases)) {
      const text = normalize(fixture(file));
      const matched = FIRST_PASS.filter((def) =>
        def.anchors.some((re) =>
          text.split("\n").some((line) => re.test(line)),
        ),
      ).map((d) => d.game);
      expect(matched, `${file} should match only ${game}`).toEqual([game]);
    }
  });
});

describe("dates", () => {
  it("parseCivil accepts only a real YYYY-MM-DD", () => {
    expect(parseCivil("2026-09-24")).toBe("2026-09-24");
    expect(parseCivil("2028-02-29")).toBe("2028-02-29");
    expect(parseCivil("2026-02-29")).toBeNull();
    expect(parseCivil("2026-13-01")).toBeNull();
    expect(parseCivil("2026-9-24")).toBeNull();
    expect(parseCivil("2026-09-24T00:00")).toBeNull();
    expect(parseCivil("")).toBeNull();
    expect(parseCivil(undefined)).toBeNull();
  });

  it("has internally consistent puzzle epochs", () => {
    expect(() => assertEpochsConsistent()).not.toThrow();
  });

  it("maps every observed Krillion puzzle number to its real date", () => {
    const observed: [number, string][] = [
      [65, "2026-09-18"], [64, "2026-09-17"], [63, "2026-09-16"],
      [62, "2026-09-15"], [61, "2026-09-14"], [60, "2026-09-13"],
      [58, "2026-09-11"], [57, "2026-09-10"], [56, "2026-09-09"],
    ];
    for (const [n, date] of observed) {
      expect(dateFromPuzzleNumber("krillion", n)).toBe(date);
    }
  });

  it("maps every observed Fermi puzzle number to its real date", () => {
    const observed: [number, string][] = [
      [53, "2026-09-17"], [52, "2026-09-16"], [51, "2026-09-15"], [50, "2026-09-14"],
    ];
    for (const [n, date] of observed) {
      expect(dateFromPuzzleNumber("fermi", n)).toBe(date);
    }
  });

  it("infers the year across the December/January boundary both ways", () => {
    expect(inferYear(12, 31, asCivil("2027-01-02")).date).toBe("2026-12-31");
    expect(inferYear(1, 1, asCivil("2026-12-31")).date).toBe("2027-01-01");
    expect(inferYear(9, 18, asCivil("2026-09-18")).date).toBe("2026-09-18");
  });

  it("does not drift across DST transitions", () => {
    // US DST starts 2026-03-08 and ends 2026-11-01.
    for (const d of ["2026-03-07", "2026-03-08", "2026-10-31", "2026-11-01"]) {
      const c = asCivil(d);
      expect(daysBetween(addDays(c, 1), c)).toBe(1);
      expect(addDays(addDays(c, 1), -1)).toBe(d);
    }
  });

  it("reads month names and abbreviations", () => {
    expect(monthFromName("September")).toBe(9);
    expect(monthFromName("Sep")).toBe(9);
    expect(monthFromName("Sept.")).toBe(9);
    expect(monthFromName("Smarch")).toBeNull();
  });

  it("resolves the civil date in the scoreboard timezone", () => {
    // 02:30 UTC on the 19th is still the 18th in Denver.
    expect(
      civilDateIn(new Date("2026-09-19T02:30:00Z"), "America/Denver"),
    ).toBe("2026-09-18");
  });
});

describe("summarize-facing behaviour", () => {
  it("keeps good games when one block in the paste is broken", () => {
    const good = fixture("krillion-daily-shortcodes.txt");
    const bad = fixture("fermi-missing-total-line.txt");
    const r = parsePaste(`${good}\n${bad}`, { submittedAt: SUBMITTED_AT });
    expect(r.status).toBe("partial");
    expect(r.entries.map((e) => e.game)).toEqual(["krillion"]);
    expect(r.failures.map((f) => f.game)).toEqual(["fermi"]);
  });
});
