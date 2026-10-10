import { describe, expect, it } from "vitest";
import { diffRules } from "./ruleDiff";
import { getScheme } from "./schemes";
import type { SchemeRule } from "./types";

const orunodoi = getScheme("orunodoi-3")!;

describe("diffRules", () => {
  it("no previous version → every top-level field is 'added'", () => {
    const d = diffRules(null, orunodoi);
    expect(d.length).toBeGreaterThan(5);
    expect(d.every((c) => c.kind === "added" && c.before === undefined)).toBe(true);
    expect(d.find((c) => c.path === "nameEn")?.after).toBe("Orunodoi 3.0 (Assam)");
  });

  it("identical rules → no changes", () => {
    expect(diffRules(orunodoi, structuredClone(orunodoi))).toEqual([]);
  });

  it("an added benefit override shows as one readable added entry, plus the version change", () => {
    const next: SchemeRule = structuredClone(orunodoi);
    next.version = "2.1.0";
    next.benefit.overrides.push({
      from: "2026-10-01",
      to: "2026-10-31",
      stateTopUp: 1500,
      noteEn: "One-time ₹1,500 for October 2026.",
      noteAs: "অক্টোবৰ ২০২৬ৰ বাবে এবাৰৰ ₹১,৫০০।",
      provenance: { ...orunodoi.benefit.provenance, sourceUrl: null, status: "provisional" },
    });
    const d = diffRules(orunodoi, next);
    expect(d.map((c) => [c.path, c.kind])).toEqual([
      ["version", "changed"],
      ["benefit.overrides[0]", "added"],
    ]);
    expect(d[0]).toMatchObject({ before: "2.0.0", after: "2.1.0" });
    expect((d[1].after as { stateTopUp: number }).stateTopUp).toBe(1500);
  });

  it("array items are matched by id (or docType), so a removed question is one 'removed' entry", () => {
    const next: SchemeRule = structuredClone(orunodoi);
    next.exclusions = next.exclusions.filter((q) => q.id !== "four_wheeler");
    next.mandatoryDocs[0].fixWhere = "gram_panchayat";
    const d = diffRules(orunodoi, next);
    expect(d).toContainEqual(expect.objectContaining({ path: "exclusions[four_wheeler]", kind: "removed" }));
    expect(d).toContainEqual({ path: "mandatoryDocs[ration_card].fixWhere", kind: "changed", before: "supply_office", after: "gram_panchayat" });
  });
});
