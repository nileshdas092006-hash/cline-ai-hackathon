// The agent's tools, called directly (no model, no network), and the run loop with a mocked agent.
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RuleTestCase } from "@/core/ruleTests";
import type { SchemeRule } from "@/core/types";

type Mod = typeof import("./ruleMaintenance");
type Schemes = typeof import("@/core/schemes");

let dir: string;
let mod: Mod;
let schemes: Schemes;
let store: InstanceType<typeof import("../store").RuleStore>;
let svc: InstanceType<typeof import("../rules").RuleService>;
const NOTICE = "Orunodoi: For the month of October 2026, eligible beneficiaries will receive a one-time amount of Rs. 1,500 instead of the regular Rs. 1,250.";

const octPatch = {
  version: "2.1.0",
  benefit: {
    overrides: [
      {
        from: "2026-10-01",
        to: "2026-10-31",
        stateTopUp: 1500,
        noteEn: "One-time ₹1,500 for October 2026 (instead of ₹1,250).",
        noteAs: "অক্টোবৰ ২০২৬ৰ বাবে এবাৰৰ ₹১,৫০০ (₹১,২৫০ৰ সলনি)।",
        provenance: { sourceUrl: null, sourceTitle: "Orunodoi notice (demo)", clause: "October 2026 one-time payment", effectiveDate: "2026-10-01", verifiedOn: "2026-10-10", version: "2.1.0", status: "provisional" },
      },
    ],
  },
};
const octTests: RuleTestCase[] = [
  { kind: "benefit", id: "oct_2026_1500", description: "October → 1500", date: "2026-10-15", expect: { stateTopUp: 1500, isOverride: true } },
  { kind: "benefit", id: "oct_31_1500", description: "31 Oct → 1500", date: "2026-10-31", expect: { stateTopUp: 1500 } },
  { kind: "benefit", id: "nov_2026_1250", description: "November → 1250", date: "2026-11-01", expect: { stateTopUp: 1250, isOverride: false } },
];

beforeEach(async () => {
  vi.resetModules();
  schemes = await import("@/core/schemes");
  mod = await import("./ruleMaintenance");
  const { RuleStore } = await import("../store");
  const { RuleService } = await import("../rules");
  dir = mkdtempSync(join(tmpdir(), "kaagaz-agent-"));
  store = new RuleStore(join(dir, "rules.db"));
  svc = new RuleService(store, () => "2026-10-10T10:00:00.000Z");
});
afterEach(() => {
  store.close();
  rmSync(dir, { recursive: true, force: true });
});

function tools() {
  const session = mod.newSession(NOTICE);
  const list = mod.createRuleTools(svc, session);
  const byName = Object.fromEntries(list.map((t) => [t.name, t]));
  const call = (name: string, input: unknown) => byName[name].execute(input as never, { agentId: "test", iteration: 1 });
  return { session, list, call };
}

describe("rule maintenance tools", () => {
  it("the prompt says an upper age limit may be left out (no placeholder such as 120)", () => {
    expect(mod.SYSTEM_PROMPT).toMatch(/ageRange\.max is optional/);
    expect(mod.SYSTEM_PROMPT).toMatch(/leave max out/);
    expect(mod.RULE_AGENT_PROMPT_VERSION).toBe("rule-agent-v2");
  });

  it("exposes exactly the five tools, each with a JSON input schema", () => {
    const { list } = tools();
    expect(list.map((t) => t.name)).toEqual(["getRuleSchema", "getCurrentRule", "proposeRule", "runTests", "saveProposal"]);
    for (const t of list) expect(t.inputSchema).toMatchObject({ type: "object" });
  });

  it("validates every tool input with its zod schema (createTool does not), returning errors instead of throwing", async () => {
    const { call, session } = tools();
    expect(await call("getCurrentRule", { schemeId: 42 })).toMatchObject({ error: expect.stringMatching(/^invalid input: schemeId/) });
    expect(await call("runTests", { tests: "all" })).toMatchObject({ error: expect.stringMatching(/tests/) });
    await call("proposeRule", { schemeId: "orunodoi-3", patch: octPatch });
    expect(await call("saveProposal", { tests: octTests, sourceNote: 7, summary: "s" })).toMatchObject({ error: expect.stringMatching(/sourceNote/) });
    expect(session.savedId).toBeNull();
  });

  it("getRuleSchema returns the SchemeRule JSON schema, the test-case schema and the scheme list", async () => {
    const out = (await tools().call("getRuleSchema", {})) as { schemeRule: { properties: object }; testCase: object; schemes: { id: string }[] };
    expect(Object.keys(out.schemeRule.properties)).toEqual(expect.arrayContaining(["id", "version", "benefit", "ageRange", "requirements"]));
    expect(out.testCase).toBeTruthy();
    expect(out.schemes.map((s) => s.id).sort()).toEqual(["nsap-widow", "orunodoi-3", "pm-kisan"]);
  });

  it("getCurrentRule returns the live rule and its regression tests; unknown → found:false", async () => {
    const { call } = tools();
    const out = (await call("getCurrentRule", { schemeId: "orunodoi-3" })) as { found: boolean; rule: SchemeRule; regressionTests: RuleTestCase[] };
    expect(out.found).toBe(true);
    expect(out.rule.version).toBe("2.0.0");
    expect(out.regressionTests.length).toBeGreaterThanOrEqual(4);
    expect(await call("getCurrentRule", { schemeId: "nsap-old-age" })).toMatchObject({ found: false });
  });

  it("proposeRule: a merge patch on the live rule → valid, with a readable diff", async () => {
    const { call, session } = tools();
    const out = (await call("proposeRule", { schemeId: "orunodoi-3", patch: octPatch })) as { valid: boolean; changes: { path: string }[] };
    expect(out.valid).toBe(true);
    expect(out.changes.map((c) => c.path)).toEqual(["version", "benefit.overrides[0]"]);
    expect(session.candidate?.version).toBe("2.1.0");
  });

  it("proposeRule: invalid data → the zod errors, and nothing is kept", async () => {
    const { call, session } = tools();
    const out = (await call("proposeRule", { schemeId: "orunodoi-3", patch: { version: "2.1.0", benefit: { period: "week" } } })) as { valid: boolean; errors: string[] };
    expect(out.valid).toBe(false);
    expect(out.errors.join(" ")).toMatch(/benefit\.period/);
    expect(session.candidate).toBeNull();
  });

  it("runTests uses the last valid proposal and runs new + regression cases", async () => {
    const { call } = tools();
    expect(await call("runTests", { tests: octTests })).toMatchObject({ ok: false });
    await call("proposeRule", { schemeId: "orunodoi-3", patch: octPatch });
    const out = (await call("runTests", { tests: octTests })) as { ok: true; passed: number; failed: number; total: number };
    expect(out).toMatchObject({ ok: true, failed: 0 });
    expect(out.total).toBeGreaterThan(octTests.length);
  });

  it("saveProposal stores status 'proposed' (never published); a second save in one run is refused", async () => {
    const { call, session } = tools();
    await call("proposeRule", { schemeId: "orunodoi-3", patch: octPatch });
    const out = (await call("saveProposal", { tests: octTests, sourceNote: "Orunodoi notice, Oct 2026", summary: "Adds a one-time October override." })) as { saved: boolean; id: number };
    expect(out.saved).toBe(true);
    expect(store.get(out.id)?.status).toBe("proposed");
    expect(session.savedId).toBe(out.id);
    expect(schemes.getScheme("orunodoi-3")?.version).toBe("2.0.0"); // a person must publish
    expect(await call("saveProposal", { tests: octTests, sourceNote: "again", summary: "again" })).toMatchObject({ saved: false });
  });
});



describe("runRuleAgent (mocked Cline SDK agent)", () => {
  type Tool = { name: string; execute: (input: unknown, ctx: unknown) => Promise<unknown> };
  type Listener = (e: { type: string } & Record<string, unknown>) => void;

  /** A fake agent that "decides" to call the real tools in a fixed order, emitting SDK-shaped events. */
  const scriptedAgent = (steps: { tool: string; input: unknown }[]) => (config: Record<string, unknown>) => {
    const listeners: Listener[] = [];
    const tools = config.tools as Tool[];
    return {
      subscribe: (l: Listener) => {
        listeners.push(l);
        return () => undefined;
      },
      abort: () => undefined,
      run: async () => {
        for (const [i, s] of steps.entries()) {
          const toolCall = { type: "tool-call", toolCallId: `c${i}`, toolName: s.tool, input: s.input };
          listeners.forEach((l) => l({ type: "tool-started", toolCall }));
          const output = await tools.find((t) => t.name === s.tool)!.execute(s.input, {});
          const message = { content: [{ type: "tool-result", toolCallId: `c${i}`, toolName: s.tool, output }] };
          listeners.forEach((l) => l({ type: "tool-finished", toolCall, message }));
        }
        listeners.forEach((l) => l({ type: "assistant-text-delta", text: "Saved.", accumulatedText: "Saved." }));
        return { status: "completed", outputText: "Saved proposal for orunodoi-3 2.1.0.", iterations: steps.length + 1 };
      },
    };
  };
  const ENV = { CLINE_API_KEY: "k", CLINE_MODEL: "anthropic/claude-sonnet-5.5" };

  it("streams each tool call and ends with the saved proposal (diff + test results)", async () => {
    const events: { type: string }[] = [];
    const createAgent = scriptedAgent([
      { tool: "getCurrentRule", input: { schemeId: "orunodoi-3" } },
      { tool: "proposeRule", input: { schemeId: "orunodoi-3", patch: octPatch } },
      { tool: "runTests", input: { tests: octTests } },
      { tool: "saveProposal", input: { tests: octTests, sourceNote: "Orunodoi notice", summary: "October override" } },
    ]);
    const res = await mod.runRuleAgent(NOTICE, { service: svc, onEvent: (e) => events.push(e), aiDeps: { env: ENV, createAgent, log: () => undefined } });

    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.proposal.status).toBe("proposed");
    expect(res.proposal.version).toBe("2.1.0");
    expect(res.proposal.testResult.failed).toBe(0);
    expect(res.proposal.changes.map((c) => c.path)).toEqual(["version", "benefit.overrides[0]"]);
    expect(res.proposal.previousVersion).toBe("2.0.0");

    const tools = events.filter((e) => e.type === "tool") as unknown as { name: string; phase: string; summary: string }[];
    expect(tools.filter((t) => t.phase === "finished").map((t) => t.name)).toEqual(["getCurrentRule", "proposeRule", "runTests", "saveProposal"]);
    expect(tools.find((t) => t.name === "runTests" && t.phase === "finished")?.summary).toMatch(/passed, 0 failed/);
    expect(events.at(-1)?.type).toBe("done");
  });

  it("if the agent finishes without saving, the result says so (no proposal)", async () => {
    const createAgent = scriptedAgent([{ tool: "getRuleSchema", input: {} }]);
    const res = await mod.runRuleAgent(NOTICE, { service: svc, aiDeps: { env: ENV, createAgent, log: () => undefined } });
    expect(res).toMatchObject({ ok: false, error: "no_proposal" });
  });

  it("without an API key → ai_unavailable, and nothing is stored", async () => {
    const res = await mod.runRuleAgent(NOTICE, { service: svc, aiDeps: { env: {}, log: () => undefined } });
    expect(res).toMatchObject({ ok: false, error: "ai_unavailable" });
    expect(store.list()).toEqual([]);
  });

  it("an empty notice is refused before any model call", async () => {
    const createAgent = vi.fn();
    const res = await mod.runRuleAgent("   ", { service: svc, aiDeps: { env: ENV, createAgent, log: () => undefined } });
    expect(res).toMatchObject({ ok: false, error: "empty_notice" });
    expect(createAgent).not.toHaveBeenCalled();
  });
});
