import { describe, expect, it } from "vitest";
import { RuleTestCase, runRuleTests, type RuleTestCase as Case } from "./ruleTests";
import { SAMPLES } from "./samples";
import { getScheme } from "./schemes";
import type { SchemeRule } from "./types";

const scheme = (id: string): SchemeRule => {
  const s = getScheme(id);
  if (!s) throw new Error(id);
  return s;
};

const withOctoberOverride = (base: SchemeRule): SchemeRule => ({
  ...base,
  version: "2.1.0",
  benefit: {
    ...base.benefit,
    overrides: [
      {
        from: "2026-10-01",
        to: "2026-10-31",
        stateTopUp: 1500,
        noteEn: "One-time ₹1,500 for October 2026.",
        noteAs: "অক্টোবৰ ২০২৬ৰ বাবে এবাৰৰ ₹১,৫০০।",
        provenance: { ...base.benefit.provenance, sourceUrl: null, status: "provisional", version: "2.1.0" },
      },
    ],
  },
});

describe("RuleTestCase schema", () => {
  it("accepts benefit and evaluate cases", () => {
    expect(
      RuleTestCase.safeParse({ kind: "benefit", id: "oct", description: "October", date: "2026-10-15", expect: { stateTopUp: 1500 } })
        .success,
    ).toBe(true);
    expect(
      RuleTestCase.safeParse({
        kind: "evaluate",
        id: "sample_a",
        description: "clean",
        asOfDate: "2026-10-10",
        docs: SAMPLES.A.docs,
        answers: SAMPLES.A.answers,
        expect: { readiness: "ready_for_review" },
      }).success,
    ).toBe(true);
  });

  it("rejects empty expectations, bad dates, unknown keys and full Aadhaar numbers", () => {
    const base = { kind: "benefit", id: "x", description: "d", date: "2026-10-15" };
    expect(RuleTestCase.safeParse({ ...base, expect: {} }).success).toBe(false);
    expect(RuleTestCase.safeParse({ ...base, date: "2026-02-30", expect: { total: 1 } }).success).toBe(false);
    expect(RuleTestCase.safeParse({ ...base, expect: { amount: 1 } }).success).toBe(false);
    expect(RuleTestCase.safeParse({ ...base, id: "Bad Id", expect: { total: 1 } }).success).toBe(false);
    const fullAadhaar = [{ docType: "aadhaar", fields: { aadhaarLast4: "123456789012" }, confidence: {} }];
    expect(
      RuleTestCase.safeParse({ kind: "evaluate", id: "x", description: "d", asOfDate: "2026-10-10", docs: fullAadhaar, answers: {}, expect: { readiness: "action_required" } }).success,
    ).toBe(false);
  });
});

describe("runRuleTests", () => {
  const oct: Case = { kind: "benefit", id: "oct", description: "October → 1500", date: "2026-10-15", expect: { stateTopUp: 1500, total: 1500, isOverride: true } };
  const nov: Case = { kind: "benefit", id: "nov", description: "November → 1250", date: "2026-11-01", expect: { stateTopUp: 1250, isOverride: false } };

  it("passes when the rule gives the expected values, and reports the origin of each case", () => {
    const report = runRuleTests(withOctoberOverride(scheme("orunodoi-3")), [
      { test: oct, origin: "new" },
      { test: nov, origin: "regression" },
    ]);
    expect(report).toMatchObject({ total: 2, passed: 2, failed: 0 });
    expect(report.results.map((r) => [r.id, r.origin, r.passed])).toEqual([
      ["oct", "new", true],
      ["nov", "regression", true],
    ]);
  });

  it("explains a failure with expected vs actual values", () => {
    const report = runRuleTests(scheme("orunodoi-3"), [{ test: oct, origin: "new" }]);
    expect(report.failed).toBe(1);
    expect(report.results[0].failures).toContain("stateTopUp: expected 1500, got 1250");
    expect(report.results[0].failures).toContain("isOverride: expected true, got false");
  });

  it("evaluate cases compare verdicts and named checks; a missing check is a failure", () => {
    const ok: Case = {
      kind: "evaluate",
      id: "b",
      description: "sample B",
      asOfDate: "2026-10-10",
      docs: SAMPLES.B.docs,
      answers: SAMPLES.B.answers,
      expect: { readiness: "action_required", checks: { name_land_record: "action_required" } },
    };
    expect(runRuleTests(scheme("pm-kisan"), [{ test: ok, origin: "new" }]).passed).toBe(1);

    const wrong: Case = { ...ok, expect: { readiness: "ready_for_review", checks: { no_such_check: "ok" } } };
    const r = runRuleTests(scheme("pm-kisan"), [{ test: wrong, origin: "new" }]).results[0];
    expect(r.passed).toBe(false);
    expect(r.failures[0]).toBe("readiness: expected ready_for_review, got action_required");
    expect(r.failures[1]).toMatch(/^check "no_such_check": not in the report/);
  });

  it("is deterministic", () => {
    const cases = [{ test: oct, origin: "new" as const }];
    const s = withOctoberOverride(scheme("orunodoi-3"));
    expect(runRuleTests(s, cases)).toEqual(runRuleTests(s, cases));
  });
});
