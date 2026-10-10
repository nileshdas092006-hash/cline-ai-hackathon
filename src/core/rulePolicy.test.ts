import { describe, expect, it } from "vitest";
import { MIN_NEW_TESTS, checkProposalPolicy, provenanceEntries } from "./rulePolicy";
import type { RuleTestCase } from "./ruleTests";
import { getScheme } from "./schemes";
import type { SchemeRule } from "./types";

const orunodoi = getScheme("orunodoi-3")!;
const widow = getScheme("nsap-widow")!;
const NOTICE = "Orunodoi: For the month of October 2026, eligible beneficiaries will receive a one-time amount of Rs. 1,500.";

const bump = (s: SchemeRule, version = "2.1.0"): SchemeRule => ({ ...structuredClone(s), version });
const tests = (n: number, prefix = "t"): RuleTestCase[] =>
  Array.from({ length: n }, (_, i) => ({ kind: "benefit", id: `${prefix}${i}`, description: "d", date: "2026-10-15", expect: { total: 1 } }));

describe("provenanceEntries", () => {
  it("finds every provenance with a stable, keyed path", () => {
    const e = provenanceEntries(orunodoi);
    expect(e.get("benefit.provenance")?.status).toBe("verified");
    expect(e.get("exclusions[four_wheeler].provenance")?.status).toBe("provisional");
    expect(e.get("mandatoryDocs[ration_card].provenance")?.status).toBe("verified");
  });
});

describe("checkProposalPolicy", () => {
  it("a proper new version passes", () => {
    expect(checkProposalPolicy({ rule: bump(orunodoi), current: orunodoi, notice: NOTICE, newTests: tests(3), regressionTestIds: ["a"] })).toEqual([]);
  });

  it("the version must go up", () => {
    const v = checkProposalPolicy({ rule: bump(orunodoi, "2.0.0"), current: orunodoi, notice: NOTICE, newTests: tests(3), regressionTestIds: [] });
    expect(v.join(" ")).toMatch(/version 2\.0\.0 must be higher than the current 2\.0\.0/);
  });

  it(`needs at least ${MIN_NEW_TESTS} new tests with ids that don't clash with regression tests`, () => {
    const v = checkProposalPolicy({ rule: bump(orunodoi), current: orunodoi, notice: NOTICE, newTests: tests(2), regressionTestIds: ["t0"] });
    expect(v.join(" ")).toMatch(/at least 3 new test cases/);
    expect(v.join(" ")).toMatch(/"t0" is already a regression test/);
    const dup = checkProposalPolicy({ rule: bump(orunodoi), current: orunodoi, notice: NOTICE, newTests: [...tests(3), ...tests(1)], regressionTestIds: [] });
    expect(dup.join(" ")).toMatch(/duplicate test id "t0"/);
  });

  it("cannot upgrade a provisional rule to verified using a source that is not in the notice", () => {
    const next = bump(orunodoi);
    const q = next.exclusions.find((x) => x.id === "four_wheeler")!;
    q.provenance = { ...orunodoi.benefit.provenance }; // verified, official URL, but not from this notice
    const v = checkProposalPolicy({ rule: next, current: orunodoi, notice: NOTICE, newTests: tests(3), regressionTestIds: [] });
    expect(v).toHaveLength(1);
    expect(v[0]).toMatch(/exclusions\[four_wheeler\]\.provenance is "verified"/);
  });

  it("verified provenance carried over unchanged, or citing a URL that is in the notice, is fine", () => {
    const url = "https://en.vikaspedia.in/viewcontent/social-welfare/social-security/pension-benefits-under-nsap?lgn=en";
    const newScheme: SchemeRule = { ...structuredClone(widow), id: "nsap-old-age", version: "1.0.0" };
    newScheme.benefit.provenance = { ...newScheme.benefit.provenance, sourceUrl: url, status: "verified" };
    newScheme.requirements = newScheme.requirements.map((q) => ({ ...q, provenance: { ...q.provenance, sourceUrl: url } }));
    newScheme.ageRange = { ...newScheme.ageRange!, provenance: { ...newScheme.ageRange!.provenance, sourceUrl: url } };
    const ok = checkProposalPolicy({ rule: newScheme, current: null, notice: `Source: ${url}\nText`, newTests: tests(3), regressionTestIds: [] });
    expect(ok).toEqual([]);

    // A new scheme has nothing to carry over: a verified URL that is not in the notice is refused.
    newScheme.ageRange = { ...newScheme.ageRange!, provenance: { ...newScheme.ageRange!.provenance, sourceUrl: "https://example.org/x", status: "verified" } };
    const v = checkProposalPolicy({ rule: newScheme, current: null, notice: `Source: ${url}\nText`, newTests: tests(3), regressionTestIds: [] });
    expect(v).toHaveLength(1);
    expect(v[0]).toMatch(/^ageRange\.provenance/);
  });
});
