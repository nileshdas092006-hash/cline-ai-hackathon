import { describe, expect, it } from "vitest";
import { runRuleTests } from "../ruleTests";
import { getScheme, listSchemes } from ".";
import { BUILTIN_REGRESSION_TESTS } from "./regression";

describe("built-in regression tests", () => {
  it("cover every built-in scheme with at least 3 cases, including a benefit case", () => {
    for (const s of listSchemes()) {
      const cases = BUILTIN_REGRESSION_TESTS[s.id];
      expect(cases?.length, s.id).toBeGreaterThanOrEqual(3);
      expect(cases.some((c) => c.kind === "benefit"), s.id).toBe(true);
    }
  });

  it("have unique ids", () => {
    const ids = Object.values(BUILTIN_REGRESSION_TESTS).flat().map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("all pass against the built-in rule packs", () => {
    for (const [id, cases] of Object.entries(BUILTIN_REGRESSION_TESTS)) {
      const report = runRuleTests(getScheme(id)!, cases.map((test) => ({ test, origin: "regression" as const })));
      expect(report.results.filter((r) => !r.passed), id).toEqual([]);
    }
  });
});
