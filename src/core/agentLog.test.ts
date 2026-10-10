import { describe, expect, it } from "vitest";
import { summarizeToolInput, summarizeToolOutput } from "./agentLog";

describe("agent log summaries", () => {
  it("describes what each tool was asked to do", () => {
    expect(summarizeToolInput("getRuleSchema", {})).toBe("Read the rule format");
    expect(summarizeToolInput("getCurrentRule", { schemeId: "orunodoi-3" })).toBe("Read the current rule: orunodoi-3");
    expect(summarizeToolInput("proposeRule", { schemeId: "orunodoi-3", patch: { version: "2.1.0" } })).toBe("Propose a change to orunodoi-3 (version 2.1.0)");
    expect(summarizeToolInput("proposeRule", { rule: { id: "nsap-old-age", version: "1.0.0" } })).toBe("Propose a rule for nsap-old-age (version 1.0.0)");
    expect(summarizeToolInput("runTests", { tests: [1, 2, 3] })).toBe("Run 3 new test(s) + regression tests");
    expect(summarizeToolInput("saveProposal", { tests: [1, 2, 3] })).toBe("Save the proposal for human review");
  });

  it("summarises tool results without dumping data", () => {
    expect(summarizeToolOutput("proposeRule", { valid: true, changes: [1, 2] })).toBe("✓ valid · 2 change(s)");
    expect(summarizeToolOutput("proposeRule", { valid: false, errors: ["a", "b", "c"] })).toBe("✗ 3 problem(s): a; b; c");
    expect(summarizeToolOutput("runTests", { ok: true, passed: 9, failed: 1, total: 10 })).toBe("✗ 9 passed, 1 failed (of 10)");
    expect(summarizeToolOutput("runTests", { ok: true, passed: 10, failed: 0, total: 10 })).toBe("✓ 10 passed, 0 failed (of 10)");
    expect(summarizeToolOutput("saveProposal", { saved: true, id: 7, version: "2.1.0" })).toBe("✓ saved as proposal #7 (version 2.1.0), waiting for approval");
    expect(summarizeToolOutput("getCurrentRule", { found: false })).toBe("No such scheme yet (a new scheme)");
    expect(summarizeToolOutput("getCurrentRule", { found: true, rule: { version: "2.0.0" }, regressionTests: [1, 2] })).toBe("Version 2.0.0 · 2 regression test(s)");
    expect(summarizeToolOutput("getRuleSchema", { schemes: [1, 2, 3] })).toBe("Schema + 3 existing scheme(s)");
    expect(summarizeToolOutput("x", { error: "boom" })).toBe("✗ boom");
  });
});
