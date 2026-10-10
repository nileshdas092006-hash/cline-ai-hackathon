// runToolAgent: the gateway's agent path. The @cline/sdk Agent is replaced by a fake (no network).
import { describe, expect, it, vi } from "vitest";
import { type AgentLike, type AiLogEntry, runToolAgent } from "./ai";

const ENV = { CLINE_API_KEY: "test-key-not-real", CLINE_MODEL: "anthropic/claude-sonnet-5.5" };
type Listener = Parameters<AgentLike["subscribe"]>[0];

/** A fake agent: each run() plays one scripted outcome and emits the given events. */
function fakeFactory(script: { status: "completed" | "failed" | "aborted"; text?: string; events?: unknown[]; throws?: boolean }[]) {
  const configs: Record<string, unknown>[] = [];
  const factory = vi.fn((config: Record<string, unknown>): AgentLike => {
    configs.push(config);
    const listeners: Listener[] = [];
    return {
      subscribe: (l) => {
        listeners.push(l);
        return () => undefined;
      },
      abort: vi.fn(),
      run: async () => {
        const step = script.shift();
        if (!step) throw new Error("no more scripted runs");
        for (const e of step.events ?? []) for (const l of listeners) l(e as never);
        if (step.throws) throw new Error("network down");
        return { status: step.status, outputText: step.text ?? "", iterations: 1, error: step.status === "failed" ? new Error("boom") : undefined };
      },
    };
  });
  return { factory, configs };
}

const base = { promptVersion: "rule-agent-v1", systemPrompt: "sys", input: "the notice", tools: [] };

describe("runToolAgent", () => {
  it("without a key or model → ai_unavailable, and never builds an agent", async () => {
    const { factory } = fakeFactory([]);
    const res = await runToolAgent({ ...base, deps: { env: {}, createAgent: factory, log: () => undefined } });
    expect(res).toEqual({ error: "ai_unavailable" });
    expect(factory).not.toHaveBeenCalled();
  });

  it("builds the Cline SDK agent with the Cline API (openai-compatible) and forwards events", async () => {
    const { factory, configs } = fakeFactory([{ status: "completed", text: "done", events: [{ type: "tool-started" }] }]);
    const seen: unknown[] = [];
    const logs: AiLogEntry[] = [];
    const res = await runToolAgent({ ...base, onEvent: (e) => seen.push(e), deps: { env: ENV, createAgent: factory, log: (e) => logs.push(e) } });
    expect(res).toEqual({ status: "completed", outputText: "done", attempts: 1 });
    expect(configs[0]).toMatchObject({
      providerId: "openai-compatible",
      baseUrl: "https://api.cline.bot/api/v1",
      apiKey: "test-key-not-real",
      modelId: "anthropic/claude-sonnet-5.5",
      systemPrompt: "sys",
    });
    expect(seen).toEqual([{ type: "tool-started" }]);
    expect(logs[0]).toMatchObject({ fn: "runToolAgent", model: "anthropic/claude-sonnet-5.5", promptVersion: "rule-agent-v1", outcome: "ok" });
    expect(logs[0].inputHash).toMatch(/^[0-9a-f]{16}$/);
    expect(JSON.stringify(logs)).not.toContain("the notice");
    expect(JSON.stringify(logs)).not.toContain("test-key-not-real");
  });

  it("retries once when the run fails before doing anything, then falls back to ai_failed", async () => {
    const { factory } = fakeFactory([{ status: "failed" }, { status: "failed" }]);
    const logs: AiLogEntry[] = [];
    const res = await runToolAgent({ ...base, deps: { env: ENV, createAgent: factory, log: (e) => logs.push(e) } });
    expect(res).toEqual({ error: "ai_failed" });
    expect(factory).toHaveBeenCalledTimes(2);
    expect(logs.map((l) => l.outcome)).toEqual(["run_failed", "run_failed"]);
  });

  it("a thrown error is caught (never thrown to the caller) and retried", async () => {
    const { factory } = fakeFactory([{ status: "completed", throws: true }, { status: "completed", text: "ok" }]);
    const res = await runToolAgent({ ...base, deps: { env: ENV, createAgent: factory, log: () => undefined } });
    expect(res).toEqual({ status: "completed", outputText: "ok", attempts: 2 });
  });

  it("does not retry once a tool has run (a retry could repeat side effects)", async () => {
    const { factory } = fakeFactory([{ status: "failed", events: [{ type: "tool-finished" }] }, { status: "completed" }]);
    const res = await runToolAgent({ ...base, deps: { env: ENV, createAgent: factory, log: () => undefined } });
    expect(res).toEqual({ error: "ai_failed" });
    expect(factory).toHaveBeenCalledTimes(1);
  });
});
