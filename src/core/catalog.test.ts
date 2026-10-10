import { describe, expect, it } from "vitest";
import { catalogOf } from "./catalog";
import { SAMPLES } from "./samples";
import { listSchemes } from "./schemes";

describe("catalogOf", () => {
  const catalog = catalogOf(listSchemes());

  it("lists every scheme with PM-KISAN first and marked flagship", () => {
    expect(catalog.map((s) => s.id)).toEqual(["pm-kisan", "orunodoi-3", "nsap-widow"]);
    expect(catalog.filter((s) => s.flagship).map((s) => s.id)).toEqual(["pm-kisan"]);
  });

  it("is plain JSON (safe to pass from a server component)", () => {
    expect(JSON.parse(JSON.stringify(catalog))).toEqual(catalog);
  });

  it("includes the questions, document slots and external-check labels", () => {
    const pm = catalog[0];
    expect(pm.questions.map((q) => q.id)).toContain("income_tax_payer");
    expect(pm.questions.map((q) => q.id)).toContain("land_in_family_member_name");
    expect(pm.slots.map((s) => s.docType)).toEqual(["aadhaar", "bank_passbook", "land_record"]);
    expect(pm.external.map((e) => e.checkId)).toContain("ext_aadhaar_bank_seeding");
  });

  it("every sample belongs to a scheme in the catalog and answers only its questions", () => {
    for (const s of Object.values(SAMPLES)) {
      const scheme = catalog.find((c) => c.id === s.schemeId);
      expect(scheme).toBeDefined();
      const ids = new Set(scheme?.questions.map((q) => q.id));
      for (const k of Object.keys(s.answers)) expect(ids.has(k), k).toBe(true);
    }
  });
});
