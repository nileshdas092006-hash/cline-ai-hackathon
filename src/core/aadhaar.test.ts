import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { maskAadhaar } from "./aadhaar";

const digitCount = (s: string) => (s.match(/\d/g) ?? []).length;

describe("maskAadhaar", () => {
  it("shows only the last 4 digits", () => {
    expect(maskAadhaar("1234 5678 9012")).toBe("XXXX XXXX 9012");
    expect(maskAadhaar("123456789012")).toBe("XXXX XXXX 9012");
    expect(maskAadhaar("9012")).toBe("XXXX XXXX 9012");
  });

  it("shows no digits when fewer than 4 are given", () => {
    expect(maskAadhaar("12")).toBe("XXXX XXXX XXXX");
    expect(maskAadhaar("")).toBe("XXXX XXXX XXXX");
  });

  it("property: never outputs more than 4 digits", () => {
    fc.assert(fc.property(fc.string(), (s) => digitCount(maskAadhaar(s)) <= 4), { numRuns: 1000 });
    fc.assert(
      fc.property(fc.stringMatching(/^\d{4} ?\d{4} ?\d{4}$/), (s) => {
        const out = maskAadhaar(s);
        const digits = s.replace(/\D/g, "");
        return digitCount(out) === 4 && out.endsWith(digits.slice(-4));
      }),
    );
  });
});
