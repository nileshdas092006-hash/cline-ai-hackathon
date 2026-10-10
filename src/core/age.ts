// Age in completed years on an explicit date (never "today" implicitly). Pure.
import { assertIsoDate } from "./dates";

/**
 * Completed years between `dob` and `asOfDate` (both YYYY-MM-DD).
 * A 29 February birthday is reached on 1 March in non-leap years.
 * Throws RangeError for invalid dates or an asOfDate before the birth date.
 */
export function ageOn(dob: string, asOfDate: string): number {
  const b = assertIsoDate(dob, "dob");
  const a = assertIsoDate(asOfDate, "asOfDate");
  if (asOfDate < dob) throw new RangeError(`asOfDate ${asOfDate} is before dob ${dob}`);
  const birthdayPassed = a.m * 100 + a.d >= b.m * 100 + b.d;
  return a.y - b.y - (birthdayPassed ? 0 : 1);
}
