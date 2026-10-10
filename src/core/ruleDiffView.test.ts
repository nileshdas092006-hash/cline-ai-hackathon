import { describe, expect, it } from "vitest";
import { changeLabel, formatValue } from "./ruleDiffView";

describe("ruleDiffView", () => {
  it("labels paths in plain English", () => {
    expect(changeLabel("version")).toBe("Version");
    expect(changeLabel("benefit.overrides[0]")).toBe("Benefit › time-limited change #1");
    expect(changeLabel("exclusions[four_wheeler]")).toBe("Exclusions › four_wheeler");
    expect(changeLabel("mandatoryDocs[ration_card].fixWhere")).toBe("Required documents › ration_card › where to fix");
    expect(changeLabel("ageRange.min")).toBe("Age limit › minimum");
  });

  it("formats values readably: provenance and overrides as short lines, primitives as text", () => {
    expect(formatValue(1500)).toBe("1500");
    expect(formatValue(null)).toBe("none");
    expect(formatValue("month")).toBe("month");
    expect(formatValue({ from: "2026-10-01", to: "2026-10-31", stateTopUp: 1500, noteEn: "One-time.", noteAs: "x", provenance: { status: "provisional", sourceTitle: "Notice", sourceUrl: null, verifiedOn: "2026-10-10", version: "2.1.0" } })).toBe(
      "2026-10-01 → 2026-10-31 · state ₹1500 · \"One-time.\" · provisional: Notice",
    );
    expect(formatValue({ min: 60, max: 120, dobFrom: "aadhaar", provenance: { status: "verified", sourceTitle: "Vikaspedia", sourceUrl: "https://x", verifiedOn: "2026-10-10", version: "1.0.0" } })).toBe(
      "60–120 years (date of birth from aadhaar) · verified: Vikaspedia",
    );
    expect(formatValue({ id: "bpl_household", textEn: "Is your household BPL?", provenance: { status: "verified", sourceTitle: "V", sourceUrl: "https://x", verifiedOn: "2026-10-10", version: "1.0.0" } })).toBe(
      "\"Is your household BPL?\" · verified: V",
    );
    expect(formatValue({ docType: "bpl_proof", fixWhere: "block_office", provenance: { status: "provisional", sourceTitle: "V", sourceUrl: null, verifiedOn: "2026-10-10", version: "1.0.0" } })).toBe(
      "bpl_proof (from block_office) · provisional: V",
    );
    expect(formatValue([{ docType: "aadhaar" }, { docType: "bank_passbook" }])).toBe("2 item(s)");
  });
});
