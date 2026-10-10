import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { ageOn } from "./age";

describe("ageOn", () => {
  it("counts completed years on an explicit date", () => {
    expect(ageOn("1986-10-10", "2026-10-10")).toBe(40);
    expect(ageOn("1986-10-11", "2026-10-10")).toBe(39);
    expect(ageOn("1946-10-10", "2026-10-10")).toBe(80);
    expect(ageOn("1947-10-11", "2026-10-10")).toBe(78);
  });

  it("handles a 29 February birthday (birthday reached on 1 March in a non-leap year)", () => {
    expect(ageOn("2000-02-29", "2025-02-28")).toBe(24);
    expect(ageOn("2000-02-29", "2025-03-01")).toBe(25);
    expect(ageOn("2000-02-29", "2024-02-29")).toBe(24);
  });

  it("rejects invalid dates and an asOfDate before the birth date", () => {
    expect(() => ageOn("1986-02-30", "2026-10-10")).toThrow(RangeError);
    expect(() => ageOn("10/10/1986", "2026-10-10")).toThrow(RangeError);
    expect(() => ageOn("2026-10-11", "2026-10-10")).toThrow(RangeError);
  });

  it("property: age on the birth date is 0 and never decreases over time", () => {
    const dateArb = fc
      .date({ min: new Date("1900-01-01T00:00:00Z"), max: new Date("2100-12-31T00:00:00Z"), noInvalidDate: true })
      .map((d) => d.toISOString().slice(0, 10));
    fc.assert(
      fc.property(dateArb, dateArb, dateArb, (a, b, c) => {
        const [dob, d1, d2] = [a, b, c].sort();
        return ageOn(dob, dob) === 0 && ageOn(dob, d1) <= ageOn(dob, d2);
      }),
    );
  });
});
