import { describe, expect, it } from "vitest";
import { REJECTION_CODES, RejectionCode, fixStepsFor } from "./rejectionCodes";

const ASSAMESE = /[\u0980-\u09FF]/;

describe("rejection codes", () => {
  it("has exactly the eight known codes", () => {
    expect([...REJECTION_CODES].sort()).toEqual(
      [
        "AADHAAR_NOT_SEEDED_BANK",
        "ACCOUNT_INACTIVE",
        "EKYC_PENDING",
        "INVALID_ACCOUNT_IFSC",
        "LAND_NOT_VERIFIED",
        "NAME_MISMATCH_AADHAAR",
        "PENDING_STATE_ACTION",
        "UNKNOWN",
      ].sort(),
    );
    expect(RejectionCode.safeParse("NOT_A_CODE").success).toBe(false);
  });

  it.each(REJECTION_CODES.map((c) => [c]))("%s has fix steps in English and Assamese", (code) => {
    const f = fixStepsFor(code);
    expect(f.code).toBe(code);
    expect(f.titleEn.length).toBeGreaterThan(3);
    expect(ASSAMESE.test(f.titleAs)).toBe(true);
    expect(f.stepsEn.length).toBeGreaterThan(0);
    expect(f.stepsAs.length).toBe(f.stepsEn.length);
    for (const s of f.stepsAs) expect(ASSAMESE.test(s)).toBe(true);
  });

  it("points name mismatches to the bank or Aadhaar centre and land to the circle office", () => {
    expect(fixStepsFor("NAME_MISMATCH_AADHAAR").fixWhere).toBe("bank");
    expect(fixStepsFor("LAND_NOT_VERIFIED").fixWhere).toBe("circle_office");
    expect(fixStepsFor("EKYC_PENDING").fixWhere).toBe("pm_kisan_portal");
  });
});
