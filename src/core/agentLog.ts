// One-line, human-readable summaries of the agent's tool calls for the live log. Pure.
// Summaries never include document data; rule notices are public text.

type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj => (typeof v === "object" && v !== null ? (v as Obj) : {});
const len = (v: unknown) => (Array.isArray(v) ? v.length : 0);
const str = (v: unknown) => (typeof v === "string" ? v : "");

export function summarizeToolInput(name: string, input: unknown): string {
  const i = obj(input);
  switch (name) {
    case "getRuleSchema":
      return "Read the rule format";
    case "getCurrentRule":
      return `Read the current rule: ${str(i.schemeId)}`;
    case "proposeRule": {
      const rule = obj(i.rule);
      const patch = obj(i.patch);
      if (i.rule !== undefined) return `Propose a rule for ${str(rule.id)} (version ${str(rule.version)})`;
      return `Propose a change to ${str(i.schemeId)} (version ${str(patch.version) || "?"})`;
    }
    case "runTests":
      return `Run ${len(i.tests)} new test(s) + regression tests`;
    case "saveProposal":
      return "Save the proposal for human review";
    default:
      return name;
  }
}

export function summarizeToolOutput(name: string, output: unknown): string {
  const o = obj(output);
  if (typeof o.error === "string") return `✗ ${o.error}`;
  switch (name) {
    case "getRuleSchema":
      return `Schema + ${len(o.schemes)} existing scheme(s)`;
    case "getCurrentRule":
      return o.found ? `Version ${str(obj(o.rule).version)} · ${len(o.regressionTests)} regression test(s)` : "No such scheme yet (a new scheme)";
    case "proposeRule":
      if (o.valid) return `✓ valid · ${len(o.changes)} change(s)`;
      return `✗ ${len(o.errors)} problem(s): ${(Array.isArray(o.errors) ? o.errors : []).slice(0, 3).join("; ")}`;
    case "runTests":
    case "saveProposal": {
      if (o.ok === false || o.saved === false) {
        const errs = Array.isArray(o.errors) ? o.errors : [];
        return `✗ ${errs.length} problem(s): ${errs.slice(0, 3).join("; ")}`;
      }
      if (name === "saveProposal") return `✓ saved as proposal #${String(o.id)} (version ${str(o.version)}), waiting for approval`;
      const failed = Number(o.failed ?? 0);
      return `${failed === 0 ? "✓" : "✗"} ${String(o.passed)} passed, ${failed} failed (of ${String(o.total)})`;
    }
    default:
      return "done";
  }
}
