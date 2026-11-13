import { addDays, civil, dayOfWeek } from "@/lib/parser/dates";
import type { CivilDate } from "@/lib/parser/types";

const MON = 1;
const THU = 4;

/** The nth `weekday` of a month; n = -1 for the last one. */
function nthWeekday(year: number, month: number, weekday: number, n: number): CivilDate {
  if (n === -1) {
    const last = addDays(civil(month === 12 ? year + 1 : year, (month % 12) + 1, 1), -1);
    return addDays(last, -((dayOfWeek(last) - weekday + 7) % 7));
  }
  const first = civil(year, month, 1);
  return addDays(first, ((weekday - dayOfWeek(first) + 7) % 7) + 7 * (n - 1));
}

/** A fixed-date holiday on a Saturday is observed the Friday before, on a Sunday
 *  the Monday after (5 U.S.C. 6103(b)). */
function observed(d: CivilDate): CivilDate {
  const dow = dayOfWeek(d);
  return dow === 6 ? addDays(d, -1) : dow === 0 ? addDays(d, 1) : d;
}

/**
 * The 11 US federal holidays of `year`, as observed. Observance can cross the
 * year: New Year's Day on a Saturday is observed on December 31 of the year
 * before, which is why `isFederalHoliday` checks the following year too.
 */
export function federalHolidays(year: number): CivilDate[] {
  return [
    observed(civil(year, 1, 1)),
    nthWeekday(year, 1, MON, 3), // Martin Luther King Jr. Day
    nthWeekday(year, 2, MON, 3), // Washington's Birthday
    nthWeekday(year, 5, MON, -1), // Memorial Day
    // Federal only since 2021, which predates every score here.
    observed(civil(year, 6, 19)), // Juneteenth
    observed(civil(year, 7, 4)),
    nthWeekday(year, 9, MON, 1), // Labor Day
    nthWeekday(year, 10, MON, 2), // Columbus Day
    observed(civil(year, 11, 11)), // Veterans Day
    nthWeekday(year, 11, THU, 4), // Thanksgiving
    observed(civil(year, 12, 25)),
  ];
}

export function isFederalHoliday(d: CivilDate): boolean {
  const year = Number(d.slice(0, 4));
  return federalHolidays(year).includes(d) || federalHolidays(year + 1).includes(d);
}

/** Monday to Friday, excluding observed federal holidays. */
export function isWorkday(d: CivilDate): boolean {
  const dow = dayOfWeek(d);
  return dow !== 0 && dow !== 6 && !isFederalHoliday(d);
}

/** The latest workday strictly before `d`. */
export function previousWorkday(d: CivilDate): CivilDate {
  let day = addDays(d, -1);
  while (!isWorkday(day)) day = addDays(day, -1);
  return day;
}
