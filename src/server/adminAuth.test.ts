// Optional admin passcode (ADMIN_PASSCODE → header x-admin-passcode on every /api/admin/* route).
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ADMIN_PASSCODE_HEADER, adminGuard, isAdminAllowed, isAdminProtected } from "./adminAuth";

const runRuleAgent = vi.fn();
vi.mock("@/server/agents/ruleMaintenance", async (orig) => ({ ...(await orig<object>()), runRuleAgent }));

const req = (passcode?: string, body?: unknown) =>
  new Request("http://localhost/api/admin/x", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(passcode !== undefined ? { [ADMIN_PASSCODE_HEADER]: passcode } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

describe("adminAuth (pure)", () => {
  it("is open when ADMIN_PASSCODE is unset or blank", () => {
    for (const env of [{}, { ADMIN_PASSCODE: "" }, { ADMIN_PASSCODE: "   " }]) {
      expect(isAdminProtected(env)).toBe(false);
      expect(isAdminAllowed(req(), env)).toBe(true);
      expect(adminGuard(req(), env)).toBeNull();
    }
  });

  it("when set, only the exact passcode in the header is allowed", async () => {
    const env = { ADMIN_PASSCODE: "tea-garden-42" };
    expect(isAdminProtected(env)).toBe(true);
    expect(isAdminAllowed(req("tea-garden-42"), env)).toBe(true);
    expect(isAdminAllowed(req(" tea-garden-42 "), env)).toBe(true); // surrounding spaces ignored
    for (const bad of [undefined, "", "tea-garden-4", "TEA-GARDEN-42", "tea-garden-42x"]) {
      expect(isAdminAllowed(req(bad), env), String(bad)).toBe(false);
    }
    const denied = adminGuard(req("wrong"), env)!;
    expect(denied.status).toBe(401);
    const text = await denied.text();
    expect(JSON.parse(text)).toEqual({ error: "passcode_required" });
    expect(text).not.toContain("tea-garden"); // never echoes the passcode
  });
});

describe("admin routes with ADMIN_PASSCODE set", () => {
  let dir: string;
  const previous = { pass: process.env.ADMIN_PASSCODE, db: process.env.KAAGAZ_DB_PATH };

  beforeEach(() => {
    vi.resetModules();
    runRuleAgent.mockReset();
    dir = mkdtempSync(join(tmpdir(), "kaagaz-auth-"));
    process.env.KAAGAZ_DB_PATH = join(dir, "auth.db");
    process.env.ADMIN_PASSCODE = "s3cret";
  });
  afterEach(async () => {
    const { getStore } = await import("./store");
    getStore().close();
    if (previous.pass === undefined) delete process.env.ADMIN_PASSCODE;
    else process.env.ADMIN_PASSCODE = previous.pass;
    process.env.KAAGAZ_DB_PATH = previous.db;
    rmSync(dir, { recursive: true, force: true });
  });

  const params = (id: string) => ({ params: Promise.resolve({ id }) });

  it("propose / publish / reject → 401 without the right passcode, and the agent never runs", async () => {
    const { POST: propose } = await import("@/app/api/admin/rules/propose/route");
    const { POST: publish } = await import("@/app/api/admin/rules/[id]/publish/route");
    const { POST: reject } = await import("@/app/api/admin/rules/[id]/reject/route");
    expect((await propose(req(undefined, { notice: "Orunodoi October" }))).status).toBe(401);
    expect((await propose(req("nope", { notice: "Orunodoi October" }))).status).toBe(401);
    expect((await publish(req(), params("1"))).status).toBe(401);
    expect((await reject(req("nope"), params("1"))).status).toBe(401);
    expect(runRuleAgent).not.toHaveBeenCalled();
  });

  it("the right passcode reaches the handlers", async () => {
    runRuleAgent.mockImplementation(async (_n: string, opts: { onEvent: (e: unknown) => void }) => {
      const result = { ok: false, error: "no_proposal", message: "none" };
      opts.onEvent({ type: "done", result });
      return result;
    });
    const { POST: propose } = await import("@/app/api/admin/rules/propose/route");
    const { POST: publish } = await import("@/app/api/admin/rules/[id]/publish/route");
    const res = await propose(req("s3cret", { notice: "Orunodoi October" }));
    expect(res.status).toBe(200);
    await res.text();
    expect(runRuleAgent).toHaveBeenCalledTimes(1);
    expect((await publish(req("s3cret"), params("999"))).status).toBe(409); // handler ran: unknown id
  });
});
