import { describe, expect, it } from "vitest";
import { getScheme, listSchemeVersions, listSchemes, questionsFor, registerScheme } from "./index";
import { SchemeRule, type RuleProvenance } from "../types";

const ASSAMESE = /[\u0980-\u09FF]/;

function allProvenance(s: SchemeRule): RuleProvenance[] {
  return [
    s.benefit.provenance,
    ...s.benefit.overrides.map((o) => o.provenance),
    ...s.mandatoryDocs.map((d) => d.provenance),
    ...s.supportingDocs.map((d) => d.provenance),
    ...(s.ageRange ? [s.ageRange.provenance] : []),
    ...s.requirements.map((q) => q.provenance),
    ...s.eligibilityAnyOf.map((q) => q.provenance),
    ...s.exclusions.map((q) => q.provenance),
    ...s.externalChecks.map((e) => e.provenance),
    ...s.fieldChecks.map((f) => f.provenance),
    ...s.nameChecks.map((n) => n.provenance),
    ...s.notes.map((n) => n.provenance),
  ];
}

describe("scheme registry", () => {
  it("lists the three v2 schemes, each valid against SchemeRule", () => {
    expect(listSchemes().map((s) => s.id).sort()).toEqual(["nsap-widow", "orunodoi-3", "pm-kisan"]);
    for (const s of listSchemes()) {
      expect(SchemeRule.safeParse(s).success).toBe(true);
      expect(s.version).toBe("2.0.0");
      expect(ASSAMESE.test(s.nameAs)).toBe(true);
      for (const q of questionsFor(s)) {
        expect(q.textEn).toMatch(/\?$/);
        expect(ASSAMESE.test(q.textAs)).toBe(true);
      }
      for (const p of allProvenance(s)) expect(p.verifiedOn).toBe("2026-10-10");
    }
  });

  it("returns undefined for an unknown id", () => {
    expect(getScheme("nope")).toBeUndefined();
  });

  it("registerScheme validates, keeps old versions and serves the newest", () => {
    const base = getScheme("nsap-widow")!;
    const next = { ...base, version: "2.1.0" };
    registerScheme(next);
    expect(getScheme("nsap-widow")?.version).toBe("2.1.0");
    expect(getScheme("nsap-widow", "2.0.0")?.version).toBe("2.0.0");
    expect(listSchemeVersions("nsap-widow")).toEqual(["2.0.0", "2.1.0"]);
    expect(listSchemes().filter((s) => s.id === "nsap-widow")).toHaveLength(1);
    expect(() => registerScheme(next)).toThrow(/already registered/);
    expect(() => registerScheme({ ...base, id: "Bad Id!", version: "1.0.0" })).toThrow();
  });
});

describe("rule packs match docs/schemes.md", () => {
  it("PM-KISAN: verified exclusions, 3 mandatory docs, 4 external checks, ₹6000/yr central", () => {
    const s = getScheme("pm-kisan", "2.0.0")!;
    expect(s.exclusions.map((q) => q.id).sort()).toEqual(
      ["govt_employee", "holds_constitutional_post", "income_tax_payer", "pension_10k_plus", "practising_professional"],
    );
    expect(s.exclusions.every((q) => q.provenance.status === "verified")).toBe(true);
    expect(s.mandatoryDocs.map((d) => d.docType)).toEqual(["aadhaar", "bank_passbook", "land_record"]);
    expect(s.externalChecks.map((e) => e.id).sort()).toEqual(["aadhaar_bank_seeding", "account_active", "ekyc", "land_verified"]);
    expect(s.benefit).toMatchObject({ centralShare: 6000, stateTopUp: 0, period: "year", instalments: 3 });
    expect(s.ageRange).toBeUndefined();
    expect(s.fieldChecks.find((f) => f.id === "ifsc")?.pattern).toBe("^[A-Z]{4}0[A-Z0-9]{6}$");
    expect(s.fieldChecks.find((f) => f.id === "account_no")?.pattern).toBe("^\\d{9,18}$");
  });

  it("Orunodoi 3.0: verified ration card + ₹1250/month; everything else provisional", () => {
    const s = getScheme("orunodoi-3", "2.0.0")!;
    expect(s.mandatoryDocs.map((d) => d.docType)).toEqual(["ration_card"]);
    expect(s.mandatoryDocs[0].provenance.status).toBe("verified");
    expect(s.benefit).toMatchObject({ centralShare: 0, stateTopUp: 1250, period: "month" });
    expect(s.benefit.provenance.status).toBe("verified");
    expect(s.benefit.overrides).toEqual([]);
    for (const q of [...s.requirements, ...s.eligibilityAnyOf, ...s.exclusions]) {
      expect(q.provenance.status).toBe("provisional");
    }
    expect(s.supportingDocs.every((d) => d.provenance.status === "provisional")).toBe(true);
    expect(s.mandatoryDocs.some((d) => d.docType === "income_certificate")).toBe(false);
  });

  it("widow pension: age 40–79 verified, BPL verified, ₹300 central, state top-up unconfirmed, docs provisional", () => {
    const s = getScheme("nsap-widow", "2.0.0")!;
    expect(s.ageRange).toMatchObject({ min: 40, max: 79 });
    expect(s.ageRange?.provenance.status).toBe("verified");
    expect(s.requirements.find((q) => q.id === "bpl_household")?.provenance.status).toBe("verified");
    expect(s.benefit).toMatchObject({ centralShare: 300, stateTopUp: null, period: "month" });
    expect(s.mandatoryDocs.map((d) => d.docType).sort()).toEqual(["aadhaar", "bank_passbook", "bpl_proof", "death_certificate"]);
    expect(s.mandatoryDocs.every((d) => d.provenance.status === "provisional")).toBe(true);
  });
});
