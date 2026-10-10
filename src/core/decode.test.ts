import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { ASK_AT_OFFICE, DECODE_CONFIDENCE_THRESHOLD, decodeResult, redactForModel } from "./decode";
import { REJECTION_CODES } from "./rejectionCodes";

const ASSAMESE = /[\u0980-\u09FF]/;

describe("decodeResult (code decides, not the model)", () => {
  it("a known code with confidence ≥ 0.7 → matched, with the fixed bilingual steps", () => {
    const r = decodeResult({ code: "AADHAAR_NOT_SEEDED_BANK", confidence: 0.92 });
    expect(r.status).toBe("matched");
    expect(r.code).toBe("AADHAAR_NOT_SEEDED_BANK");
    expect(r.fix.code).toBe("AADHAAR_NOT_SEEDED_BANK");
    expect(r.fix.stepsAs.every((s) => ASSAMESE.test(s))).toBe(true);
    expect(r.possible).toBeNull();
    expect(r.ask).toEqual([]);
  });

  it("exactly at the threshold counts as matched; just below does not", () => {
    expect(DECODE_CONFIDENCE_THRESHOLD).toBe(0.7);
    expect(decodeResult({ code: "EKYC_PENDING", confidence: 0.7 }).status).toBe("matched");
    expect(decodeResult({ code: "EKYC_PENDING", confidence: 0.69 }).status).toBe("needs_verification");
  });

  it("low confidence → needs verification: UNKNOWN steps + what to ask, the guess shown only as 'possible'", () => {
    const r = decodeResult({ code: "LAND_NOT_VERIFIED", confidence: 0.4 });
    expect(r).toMatchObject({ status: "needs_verification", code: "UNKNOWN", confidence: 0.4 });
    expect(r.fix.code).toBe("UNKNOWN");
    expect(r.possible?.code).toBe("LAND_NOT_VERIFIED");
    expect(r.ask).toEqual(ASK_AT_OFFICE);
  });

  it("UNKNOWN (any confidence) or no AI answer → needs verification with what to ask", () => {
    for (const r of [decodeResult({ code: "UNKNOWN", confidence: 0.99 }), decodeResult(null)]) {
      expect(r.status).toBe("needs_verification");
      expect(r.code).toBe("UNKNOWN");
      expect(r.possible).toBeNull();
      expect(r.ask.length).toBeGreaterThanOrEqual(2);
    }
    expect(decodeResult(null).confidence).toBeNull();
  });

  it("what-to-ask questions exist in English and Assamese (ৰ, not Bengali র)", () => {
    for (const q of ASK_AT_OFFICE) {
      expect(q.en.length).toBeGreaterThan(10);
      expect(ASSAMESE.test(q.as)).toBe(true);
      expect(q.as.includes("\u09B0")).toBe(false);
    }
  });

  it("property: matched ⇔ known code and confidence ≥ 0.7; out-of-range confidence never matches", () => {
    fc.assert(
      fc.property(fc.constantFrom(...REJECTION_CODES), fc.double({ min: -1, max: 2, noNaN: true }), (code, confidence) => {
        const r = decodeResult({ code, confidence });
        const expected = code !== "UNKNOWN" && confidence >= 0.7 && confidence <= 1;
        return (r.status === "matched") === expected && (r.status === "matched" ? r.code === code : r.code === "UNKNOWN");
      }),
      { numRuns: 500 },
    );
  });
});

describe("redactForModel (minimum data to the model)", () => {
  it("masks Aadhaar-like 12-digit numbers to the last 4 and hides long account numbers", () => {
    expect(redactForModel("Aadhaar 1234 5678 4821 not seeded")).toBe("Aadhaar XXXX XXXX 4821 not seeded");
    expect(redactForModel("Aadhaar 123456784821")).toBe("Aadhaar XXXX XXXX 4821");
    expect(redactForModel("A/c 30012345678 IFSC SBIN0001234")).toBe("A/c [number] IFSC SBIN0001234");
  });

  it("keeps short numbers, dates and words", () => {
    const t = "Reg. no 4567, rejected on 12-03-2026: Name mismatch (PFMS).";
    expect(redactForModel(t)).toBe(t);
  });

  it("property: no run of 9+ digits survives", () => {
    fc.assert(
      fc.property(fc.string({ unit: fc.constantFrom("1", "2", "9", " ", "-", "a", ":") }), (s) => !/\d{9,}/.test(redactForModel(s).replace(/[\s-]/g, ""))),
      { numRuns: 1000 },
    );
  });
});
