import { describe, expect, it } from "vitest";
import { evaluate } from "./evaluate";
import { benefitView, formatInr, sectionsOf, toneOf, TONE_EMOJI } from "./reportView";
import { SAMPLES } from "./samples";
import { getScheme } from "./schemes";
import type { Report } from "./types";

const AS_OF = "2026-10-10";
function run(id: keyof typeof SAMPLES): Report {
  const s = SAMPLES[id];
  const scheme = getScheme(s.schemeId);
  if (!scheme) throw new Error(s.schemeId);
  return evaluate(scheme, s.docs, s.answers, AS_OF);
}
const ids = (xs: { id: string }[]) => xs.map((x) => x.id);

describe("sectionsOf", () => {
  it("sample A: nothing to fix; bank seeding is in 'please verify' and in the external list", () => {
    const r = run("A");
    const s = sectionsOf(r);
    expect(r.readiness).toBe("ready_for_review");
    expect(s.fix).toEqual([]);
    expect(ids(s.verify)).toContain("ext_aadhaar_bank_seeding");
    expect(ids(s.external)).toContain("ext_aadhaar_bank_seeding");
    expect(s.verify.every((c) => c.kind === "external")).toBe(true);
  });

  it("sample B: land record mismatch to fix, bank name variant to verify", () => {
    const s = sectionsOf(run("B"));
    expect(ids(s.fix)).toContain("name_land_record");
    expect(ids(s.verify)).toContain("name_bank_passbook");
  });

  it("sample C: missing death certificate to fix", () => {
    const r = run("C");
    expect(r.readiness).toBe("action_required");
    expect(ids(sectionsOf(r).fix)).toContain("doc_death_certificate");
  });

  it("every check lands in exactly one section; external checks come last in 'verify'", () => {
    for (const id of ["A", "B", "C"] as const) {
      const r = run(id);
      const s = sectionsOf(r);
      expect(s.fix.length + s.verify.length + s.ok.length).toBe(r.checks.length);
      const firstExternal = s.verify.findIndex((c) => c.kind === "external");
      if (firstExternal >= 0) expect(s.verify.slice(firstExternal).every((c) => c.kind === "external")).toBe(true);
    }
  });
});

describe("tones", () => {
  it("maps both verdicts to traffic-light colours", () => {
    expect(TONE_EMOJI[toneOf("likely_eligible")]).toBe("🟢");
    expect(TONE_EMOJI[toneOf("ready_for_review")]).toBe("🟢");
    expect(TONE_EMOJI[toneOf("not_eligible")]).toBe("🔴");
    expect(TONE_EMOJI[toneOf("action_required")]).toBe("🔴");
    expect(TONE_EMOJI[toneOf("needs_verification")]).toBe("🟡");
    expect(TONE_EMOJI.grey).toBe("⚪");
  });
});

describe("money", () => {
  it("formats rupees with Indian digit grouping", () => {
    expect(formatInr(0)).toBe("₹0");
    expect(formatInr(300)).toBe("₹300");
    expect(formatInr(6000)).toBe("₹6,000");
    expect(formatInr(125000)).toBe("₹1,25,000");
    expect(formatInr(12345678)).toBe("₹1,23,45,678");
  });

  it("shows central share and state top-up separately; no total when the top-up is unconfirmed", () => {
    const widow = benefitView(run("C").benefit);
    expect(widow.central).toBe("₹300");
    expect(widow.stateTopUp).toBeNull();
    expect(widow.total).toBeNull();
    const pm = benefitView(run("A").benefit);
    expect(pm).toMatchObject({ central: "₹6,000", stateTopUp: "₹0", total: "₹6,000", period: "year", instalments: 3 });
  });
});
