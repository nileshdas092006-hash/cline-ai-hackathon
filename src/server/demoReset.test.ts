// demo:reset end to end: after publishing agent versions, a reset leaves only the 3 built-in
// schemes at their built-in versions (what the home page lists), in a fresh server process.
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SchemeRule } from "@/core/types";

let dir: string;
let dbPath: string;
const open: { close(): void }[] = [];

beforeEach(() => {
  vi.resetModules();
  dir = mkdtempSync(join(tmpdir(), "kaagaz-reset-"));
  dbPath = join(dir, "kaagaz.db");
});
afterEach(() => {
  for (const s of open.splice(0)) {
    try {
      s.close();
    } catch {
      // already closed
    }
  }
  rmSync(dir, { recursive: true, force: true });
});

/** A fresh "server process": new registry (built-ins only) + a service on the given DB file. */
async function freshProcess() {
  vi.resetModules();
  const schemes = await import("@/core/schemes");
  const { RuleStore } = await import("./store");
  const { RuleService } = await import("./rules");
  const { catalogOf } = await import("@/core/catalog");
  const store = new RuleStore(dbPath);
  open.push(store);
  const svc = new RuleService(store, () => "2026-10-10T10:00:00.000Z");
  svc.syncRegistry();
  return { schemes, store, svc, catalog: () => catalogOf(schemes.listSchemes()) };
}

describe("demo reset", () => {
  it("removes agent-added schemes and versions; the home catalog lists only the 3 originals", async () => {
    const p1 = await freshProcess();
    const builtIn = Object.fromEntries(p1.schemes.listSchemes().map((s) => [s.id, s.version]));

    // Publish a new scheme (like the IGNOAPS demo) through the real service.
    const oldAge: SchemeRule = { ...structuredClone(p1.schemes.getScheme("nsap-widow")!), id: "nsap-old-age", version: "1.0.0", nameEn: "Old Age Pension" };
    const tests = [1, 2, 3].map((n) => ({ kind: "benefit" as const, id: `t${n}`, description: "central 300", date: "2026-10-1" + n, expect: { centralShare: 300 } }));
    // Verified provenance must cite a URL from the notice (rulePolicy), so the notice lists them.
    const urls = [...new Set(JSON.stringify(oldAge).match(/https?:\/\/[^"]+/g) ?? [])];
    const notice = `IGNOAPS guideline. Sources: ${urls.join(" ")}`;
    const saved = p1.svc.saveProposal({ rule: oldAge, tests, sourceNote: "demo", notice, summary: "new scheme" });
    if (!saved.ok) throw new Error(saved.errors.join("; "));
    expect(p1.svc.publish(saved.row.id).ok).toBe(true);
    expect(p1.catalog().map((s) => s.id)).toContain("nsap-old-age");
    p1.store.close();

    // Before the reset, a new process still sees it (it is persisted).
    const p2 = await freshProcess();
    expect(p2.catalog()).toHaveLength(4);
    expect(p2.store.resetAll()).toBe(1);
    p2.store.close();

    // After the reset, a new process has only the built-ins, at their built-in versions.
    const p3 = await freshProcess();
    const catalog = p3.catalog();
    expect(catalog.map((s) => s.id).sort()).toEqual(["nsap-widow", "orunodoi-3", "pm-kisan"]);
    for (const s of catalog) expect(s.version).toBe(builtIn[s.id]);
    expect(p3.store.list()).toEqual([]);
    p3.store.close();
  });

  it("a server that is already running drops the reset versions on its next request (syncRegistry)", async () => {
    const p = await freshProcess();
    const oru = structuredClone(p.schemes.getScheme("orunodoi-3")!);
    oru.version = "2.1.0";
    p.schemes.registerScheme(oru); // as if published earlier in this process
    expect(p.catalog().find((s) => s.id === "orunodoi-3")?.version).toBe("2.1.0");

    p.svc.syncRegistry(); // 2.1.0 is not in the (empty) store → registry rebuilt from built-ins
    expect(p.catalog().find((s) => s.id === "orunodoi-3")?.version).toBe("2.0.0");
    expect(p.catalog()).toHaveLength(3);
    expect(p.schemes.listSchemeVersions("orunodoi-3")).toEqual(["2.0.0"]);
  });
});
