// Admin API handlers. The agent is mocked (no network); the store is a temp node:sqlite file.
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RuleTestCase } from "@/core/ruleTests";
import type { SchemeRule } from "@/core/types";

const runRuleAgent = vi.fn();
vi.mock("@/server/agents/ruleMaintenance", async (orig) => ({ ...(await orig<object>()), runRuleAgent }));

let dir: string;
const previousDbPath = process.env.KAAGAZ_DB_PATH;

beforeEach(() => {
  vi.resetModules();
  runRuleAgent.mockReset();
  dir = mkdtempSync(join(tmpdir(), "kaagaz-admin-"));
  process.env.KAAGAZ_DB_PATH = join(dir, "admin.db");
});
afterEach(async () => {
  const { getStore } = await import("./store");
  getStore().close();
  process.env.KAAGAZ_DB_PATH = previousDbPath;
  rmSync(dir, { recursive: true, force: true });
});

const json = (body: unknown) => new Request("http://localhost/x", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

async function seedProposal() {
  const { getScheme } = await import("@/core/schemes");
  const { getRuleService } = await import("./rules");
  const rule: SchemeRule = structuredClone(getScheme("orunodoi-3")!);
  rule.version = "2.1.0";
  rule.benefit.overrides = [
    {
      from: "2026-10-01",
      to: "2026-10-31",
      stateTopUp: 1500,
      noteEn: "One-time ₹1,500 for October 2026.",
      noteAs: "অক্টোবৰ ২০২৬ৰ বাবে এবাৰৰ ₹১,৫০০।",
      provenance: { ...rule.benefit.provenance, sourceUrl: null, status: "provisional" },
    },
  ];
  const tests: RuleTestCase[] = [
    { kind: "benefit", id: "oct_a", description: "Oct", date: "2026-10-01", expect: { stateTopUp: 1500 } },
    { kind: "benefit", id: "oct_b", description: "Oct", date: "2026-10-31", expect: { stateTopUp: 1500 } },
    { kind: "benefit", id: "nov_a", description: "Nov", date: "2026-11-01", expect: { stateTopUp: 1250 } },
  ];
  const res = getRuleService().saveProposal({ rule, tests, sourceNote: "Oct notice", notice: "Orunodoi October 2026", summary: "Oct override" });
  if (!res.ok) throw new Error(res.errors.join("; "));
  return res.row.id;
}

describe("POST /api/admin/rules/propose", () => {
  it("streams NDJSON events from the agent and ends with the result", async () => {
    runRuleAgent.mockImplementation(async (_notice: string, opts: { onEvent: (e: unknown) => void }) => {
      opts.onEvent({ type: "tool", id: "1", name: "getRuleSchema", phase: "started", summary: "Read the rule format" });
      const result = { ok: false, error: "no_proposal", message: "none" };
      opts.onEvent({ type: "done", result });
      return result;
    });
    const { POST } = await import("@/app/api/admin/rules/propose/route");
    const res = await POST(json({ notice: "Orunodoi: October 2026 Rs. 1,500" }));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/application\/x-ndjson/);
    const lines = (await res.text()).trim().split("\n").map((l) => JSON.parse(l));
    expect(lines.map((l) => l.type)).toEqual(["tool", "done"]);
    expect(runRuleAgent.mock.calls[0][0]).toBe("Orunodoi: October 2026 Rs. 1,500");
  });

  it("rejects an empty or oversized notice with 400 before running the agent", async () => {
    const { POST } = await import("@/app/api/admin/rules/propose/route");
    expect((await POST(json({ notice: "  " }))).status).toBe(400);
    expect((await POST(json({ notice: "x".repeat(20_001) }))).status).toBe(400);
    expect((await POST(new Request("http://localhost/x", { method: "POST", body: "{bad" }))).status).toBe(400);
    expect(runRuleAgent).not.toHaveBeenCalled();
  });
});

describe("GET /api/admin/rules + publish / reject", () => {
  it("lists versions per scheme with diff and test results", async () => {
    const id = await seedProposal();
    // The route only adds `await connection()` (needs a real Next request scope) before this handler.
    const { handleList } = await import("./adminApi");
    const body = await (await handleList()).json();
    const oru = body.schemes.find((s: { id: string }) => s.id === "orunodoi-3");
    expect(oru.liveVersion).toBe("2.0.0");
    expect(oru.versions[0]).toMatchObject({ id, version: "2.1.0", status: "proposed", previousVersion: "2.0.0" });
    expect(oru.versions[0].changes.map((c: { path: string }) => c.path)).toEqual(["version", "benefit.overrides[0]"]);
    expect(oru.versions[0].testResult.failed).toBe(0);
    expect(oru.builtinVersion).toBe("2.0.0");
  });

  it("publish makes the version live (the citizen /api/check uses it at once); reject does not", async () => {
    const id = await seedProposal();
    const { POST: publish } = await import("@/app/api/admin/rules/[id]/publish/route");
    const res = await publish(new Request("http://localhost/x", { method: "POST" }), { params: Promise.resolve({ id: String(id) }) });
    expect(res.status).toBe(200);
    expect((await res.json()).row).toMatchObject({ status: "published", version: "2.1.0" });

    const { POST: check } = await import("@/app/api/check/route");
    const report = await (await check(json({ schemeId: "orunodoi-3", docs: [], answers: {}, asOfDate: "2026-10-15" }))).json();
    expect(report.schemeVersion).toBe("2.1.0");
    expect(report.benefit).toMatchObject({ stateTopUp: 1500, isOverride: true });

    const { POST: reject } = await import("@/app/api/admin/rules/[id]/reject/route");
    const again = await reject(new Request("http://localhost/x", { method: "POST" }), { params: Promise.resolve({ id: String(id) }) });
    expect(again.status).toBe(409);
  });

  it("bad or unknown ids → 400 / 409", async () => {
    const { POST: publish } = await import("@/app/api/admin/rules/[id]/publish/route");
    expect((await publish(new Request("http://localhost/x", { method: "POST" }), { params: Promise.resolve({ id: "abc" }) })).status).toBe(400);
    expect((await publish(new Request("http://localhost/x", { method: "POST" }), { params: Promise.resolve({ id: "999" }) })).status).toBe(409);
  });
});
