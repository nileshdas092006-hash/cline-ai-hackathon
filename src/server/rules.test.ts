// Rule-version service: validation, tests, proposals, publish/reject and registry sync.
// Real node:sqlite in a temp folder; no network, no model. The scheme registry is module state,
// so every test re-imports the modules (vi.resetModules) to start from the built-in packs only.
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RuleTestCase } from "@/core/ruleTests";
import type { SchemeRule } from "@/core/types";

type Schemes = typeof import("@/core/schemes");
type Rules = typeof import("./rules");
type Store = typeof import("./store");

let dir: string;
let schemes: Schemes;
let rules: Rules;
let storeMod: Store;
let store: InstanceType<Store["RuleStore"]>;
let svc: InstanceType<Rules["RuleService"]>;
const NOW = "2026-10-10T10:00:00.000Z";
const NOTICE = "Orunodoi: For the month of October 2026, eligible beneficiaries will receive a one-time amount of Rs. 1,500.";

function octoberVersion(version = "2.1.0"): SchemeRule {
  const base = structuredClone(schemes.getScheme("orunodoi-3", "2.0.0")!);
  base.version = version;
  base.benefit.overrides = [
    {
      from: "2026-10-01",
      to: "2026-10-31",
      stateTopUp: 1500,
      noteEn: "One-time ₹1,500 for October 2026 (instead of ₹1,250).",
      noteAs: "অক্টোবৰ ২০২৬ৰ বাবে এবাৰৰ ₹১,৫০০ (₹১,২৫০ৰ সলনি)।",
      provenance: { ...base.benefit.provenance, sourceUrl: null, status: "provisional", clause: "October 2026 one-time payment" },
    },
  ];
  return base;
}

const octTests: RuleTestCase[] = [
  { kind: "benefit", id: "oct_2026_1500", description: "October → 1500", date: "2026-10-15", expect: { stateTopUp: 1500, isOverride: true } },
  { kind: "benefit", id: "oct_last_day", description: "31 October → 1500", date: "2026-10-31", expect: { stateTopUp: 1500 } },
  { kind: "benefit", id: "nov_2026_1250", description: "November → 1250", date: "2026-11-01", expect: { stateTopUp: 1250, isOverride: false } },
];
const proposal = (rule: SchemeRule, tests = octTests) => ({ rule, tests, sourceNote: "Oct 2026 notice", notice: NOTICE, summary: "October override" });

beforeEach(async () => {
  vi.resetModules();
  schemes = await import("@/core/schemes");
  rules = await import("./rules");
  storeMod = await import("./store");
  dir = mkdtempSync(join(tmpdir(), "kaagaz-rules-"));
  store = new storeMod.RuleStore(join(dir, "rules.db"));
  svc = new rules.RuleService(store, () => NOW);
});
afterEach(() => {
  store.close();
  rmSync(dir, { recursive: true, force: true });
});

describe("RuleService.validate", () => {
  it("accepts a valid new version and lists zod problems for a broken one", () => {
    expect(svc.validate(octoberVersion(), NOTICE)).toMatchObject({ ok: true });
    const broken = { ...octoberVersion(), version: "two", benefit: { ...octoberVersion().benefit, period: "week" } };
    const res = svc.validate(broken, NOTICE);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.errors.some((e) => e.startsWith("version:"))).toBe(true);
      expect(res.errors.some((e) => e.startsWith("benefit.period:"))).toBe(true);
    }
  });

  it("applies policy: the version must go up", () => {
    const res = svc.validate(octoberVersion("2.0.0"), NOTICE);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.errors.join(" ")).toMatch(/must be higher than the current 2\.0\.0/);
  });
});

describe("RuleService.runTests", () => {
  it("runs the new cases AND the scheme's regression tests", () => {
    const res = svc.runTests(octoberVersion(), octTests);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.report.results.filter((r) => r.origin === "new")).toHaveLength(3);
    expect(res.report.results.filter((r) => r.origin === "regression").length).toBeGreaterThanOrEqual(4);
    expect(res.report.failed).toBe(0);
  });

  it("a new case that contradicts the rule fails, with a reason", () => {
    const bad: RuleTestCase = { kind: "benefit", id: "oct_wrong", description: "wrong amount", date: "2026-10-15", expect: { stateTopUp: 2000 } };
    const res = svc.runTests(octoberVersion(), [bad]);
    expect(res.ok && res.report.results.find((r) => r.id === "oct_wrong")?.failures[0]).toBe("stateTopUp: expected 2000, got 1500");
  });

  it("a rule change that breaks an old behaviour fails the regression tests", () => {
    const broken = octoberVersion();
    broken.benefit.stateTopUp = 1000;
    const res = svc.runTests(broken, octTests);
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.report.results.find((r) => r.id === "oru_benefit_1250")?.passed).toBe(false);
  });
});

describe("RuleService.saveProposal → publish / reject", () => {
  it("refuses to save a proposal with too few new tests (nothing is stored)", () => {
    const res = svc.saveProposal(proposal(octoberVersion(), octTests.slice(0, 2)));
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.errors.join(" ")).toMatch(/at least 3 new test cases/);
    expect(store.list()).toEqual([]);
  });

  it("refuses to save a proposal whose tests fail", () => {
    const broken = octoberVersion();
    broken.benefit.stateTopUp = 1000;
    const res = svc.saveProposal(proposal(broken));
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.errors.join(" ")).toMatch(/oru_benefit_1250/);
  });

  it("saves a passing proposal (not live yet); publishing makes it live and keeps the old version", () => {
    const saved = svc.saveProposal(proposal(octoberVersion()));
    if (!saved.ok) throw new Error(saved.errors.join("; "));
    expect(saved.row.status).toBe("proposed");
    expect(saved.row.testResult.failed).toBe(0);
    expect(schemes.getScheme("orunodoi-3")?.version).toBe("2.0.0");

    expect(svc.publish(saved.row.id)).toMatchObject({ ok: true });
    expect(schemes.getScheme("orunodoi-3")?.version).toBe("2.1.0");
    expect(schemes.listSchemeVersions("orunodoi-3")).toEqual(["2.0.0", "2.1.0"]);
    // Its tests become regression tests for the next version.
    expect(svc.regressionTests("orunodoi-3").map((t) => t.id)).toEqual(expect.arrayContaining(["oru_benefit_1250", "oct_2026_1500"]));
  });

  it("publishing re-checks first, so a stale proposal cannot go live", () => {
    const a = svc.saveProposal(proposal(octoberVersion("2.1.0")));
    const b = svc.saveProposal(proposal(octoberVersion("2.1.0"), octTests.map((t) => ({ ...t, id: `${t.id}_b` }))));
    if (!a.ok || !b.ok) throw new Error("setup");
    expect(svc.publish(a.row.id)).toMatchObject({ ok: true });
    const res = svc.publish(b.row.id);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.errors.join(" ")).toMatch(/must be higher than the current 2\.1\.0/);
    expect(store.get(b.row.id)?.status).toBe("proposed");
  });

  it("reject keeps the row and changes nothing live; it can't be rejected twice", () => {
    const saved = svc.saveProposal(proposal(octoberVersion()));
    if (!saved.ok) throw new Error("setup");
    expect(svc.reject(saved.row.id)).toMatchObject({ ok: true });
    expect(store.get(saved.row.id)?.status).toBe("rejected");
    expect(schemes.getScheme("orunodoi-3")?.version).toBe("2.0.0");
    expect(svc.reject(saved.row.id)).toMatchObject({ ok: false });
    expect(svc.publish(12345)).toMatchObject({ ok: false });
  });

  it("syncRegistry registers versions published by another process, exactly once", () => {
    const otherStore = new storeMod.RuleStore(join(dir, "rules.db"));
    const other = new rules.RuleService(otherStore, () => NOW);
    const saved = other.saveProposal(proposal(octoberVersion("2.2.0")));
    if (!saved.ok) throw new Error("setup");
    other.publish(saved.row.id);
    otherStore.close();
    svc.syncRegistry();
    svc.syncRegistry();
    expect(schemes.listSchemeVersions("orunodoi-3").filter((v) => v === "2.2.0")).toHaveLength(1);
  });
});

