import { describe, expect, it } from "vitest";
import { wrongDayReason } from "../submit-date";
import { asCivil } from "../parser/dates";

const entry = { displayName: "Globle", puzzleDate: asCivil("2026-11-13") };

describe("wrongDayReason", () => {
  it("accepts any date when no day is being recorded", () => {
    expect(wrongDayReason(entry, undefined)).toBeNull();
  });

  it("accepts a share for the day being recorded", () => {
    expect(wrongDayReason(entry, "2026-11-13")).toBeNull();
  });

  it("names both days and where to go for any other", () => {
    expect(wrongDayReason(entry, "2026-11-12")).toBe(
      "That's the Globle puzzle for 2026-11-13, not 2026-11-12. Go to 2026-11-13 on the board to record it.",
    );
  });
});
