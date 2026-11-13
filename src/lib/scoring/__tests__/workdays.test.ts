import { describe, expect, it } from "vitest";
import { federalHolidays, isFederalHoliday, isWorkday, previousWorkday } from "../workdays";
import { asCivil } from "@/lib/parser/dates";

const c = asCivil;

describe("federalHolidays", () => {
  it("matches the 2026 OPM schedule", () => {
    expect(federalHolidays(2026)).toEqual([
      "2026-01-01", "2026-01-19", "2026-02-16", "2026-05-25", "2026-06-19",
      "2026-07-03", // July 4 is a Saturday
      "2026-09-07", "2026-10-12", "2026-11-11", "2026-11-26", "2026-12-25",
    ]);
  });

  it("matches the 2027 OPM schedule", () => {
    expect(federalHolidays(2027)).toEqual([
      "2027-01-01", "2027-01-18", "2027-02-15", "2027-05-31",
      "2027-06-18", // Juneteenth is a Saturday
      "2027-07-05", // July 4 is a Sunday
      "2027-09-06", "2027-10-11", "2027-11-11", "2027-11-25",
      "2027-12-24", // Christmas is a Saturday
    ]);
  });

  it("observes a Saturday New Year's Day on December 31 of the year before", () => {
    // 2028-01-01 is a Saturday.
    expect(federalHolidays(2028)[0]).toBe("2027-12-31");
    expect(isFederalHoliday(c("2027-12-31"))).toBe(true);
    expect(isFederalHoliday(c("2028-01-01"))).toBe(false);
  });

  it("finds the last Monday when May has five", () => {
    // May 2028 has Mondays on the 1st and the 29th.
    expect(federalHolidays(2028)[3]).toBe("2028-05-29");
  });
});

describe("isWorkday", () => {
  it("is false on weekends and observed holidays, true otherwise", () => {
    expect(isWorkday(c("2026-11-13"))).toBe(true); // Friday
    expect(isWorkday(c("2026-11-14"))).toBe(false); // Saturday
    expect(isWorkday(c("2026-11-15"))).toBe(false); // Sunday
    expect(isWorkday(c("2026-11-11"))).toBe(false); // Veterans Day
    expect(isWorkday(c("2026-07-03"))).toBe(false); // observed July 4
    expect(isWorkday(c("2026-11-27"))).toBe(true); // the day after Thanksgiving isn't federal
  });
});

describe("previousWorkday", () => {
  it("steps over weekends and holidays", () => {
    expect(previousWorkday(c("2026-11-16"))).toBe("2026-11-13"); // Mon → Fri
    expect(previousWorkday(c("2026-11-14"))).toBe("2026-11-13"); // Sat → Fri
    expect(previousWorkday(c("2026-11-12"))).toBe("2026-11-10"); // over Veterans Day
    // Over Christmas, a weekend and New Year's observed on a Friday.
    expect(previousWorkday(c("2027-01-03"))).toBe("2026-12-31");
    expect(previousWorkday(c("2026-12-28"))).toBe("2026-12-24");
  });
});
