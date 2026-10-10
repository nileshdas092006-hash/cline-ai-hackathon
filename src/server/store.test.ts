// The store against a real node:sqlite file in a temp folder (no network).
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getScheme } from "@/core/schemes";
import { BUILTIN_REGRESSION_TESTS } from "@/core/schemes/regression";
import { RuleStore } from "./store";

let dir: string;
let store: RuleStore;
const orunodoi = getScheme("orunodoi-3")!;
const tests = BUILTIN_REGRESSION_TESTS["orunodoi-3"];
const testResult = { total: 4, passed: 4, failed: 0, results: [] };

const proposal = (version: string) => ({
  rule: { ...orunodoi, version },
  tests,
  testResult,
  sourceNote: "October 2026 one-time payment",
  notice: "Orunodoi: for October 2026 ...",
  summary: "Add an October override",
});

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "kaagaz-store-"));
  store = new RuleStore(join(dir, "rules.db"));
});
afterEach(() => {
  store.close();
  rmSync(dir, { recursive: true, force: true });
});

describe("RuleStore", () => {
  it("uses WAL mode and starts empty", () => {
    expect(store.journalMode()).toBe("wal");
    expect(store.list()).toEqual([]);
  });

  it("saves a proposal and reads it back exactly", () => {
    const saved = store.saveProposal(proposal("2.1.0"), "2026-10-10T10:00:00.000Z");
    expect(saved).toMatchObject({ schemeId: "orunodoi-3", version: "2.1.0", status: "proposed", approvedAt: null });
    const got = store.get(saved.id)!;
    expect(got.rule).toEqual({ ...orunodoi, version: "2.1.0" });
    expect(got.tests).toEqual(tests);
    expect(got.testResult).toEqual(testResult);
    expect(got.createdAt).toBe("2026-10-10T10:00:00.000Z");
  });

  it("publish → status published with approvedAt; it appears in publishedVersions; can't publish twice", () => {
    const { id } = store.saveProposal(proposal("2.1.0"), "2026-10-10T10:00:00.000Z");
    const published = store.setStatus(id, "published", "2026-10-10T10:05:00.000Z");
    expect(published).toMatchObject({ status: "published", approvedAt: "2026-10-10T10:05:00.000Z" });
    expect(store.publishedVersions().map((r) => r.version)).toEqual(["2.1.0"]);
    expect(() => store.setStatus(id, "rejected", "2026-10-10T10:06:00.000Z")).toThrow(/not proposed/);
  });

  it("reject keeps the row (history) but never publishes it", () => {
    const { id } = store.saveProposal(proposal("2.1.0"), "2026-10-10T10:00:00.000Z");
    store.setStatus(id, "rejected", "2026-10-10T10:01:00.000Z");
    expect(store.get(id)?.status).toBe("rejected");
    expect(store.publishedVersions()).toEqual([]);
  });

  it("only one published row per scheme + version", () => {
    const a = store.saveProposal(proposal("2.1.0"), "2026-10-10T10:00:00.000Z");
    const b = store.saveProposal(proposal("2.1.0"), "2026-10-10T10:01:00.000Z");
    store.setStatus(a.id, "published", "2026-10-10T10:02:00.000Z");
    expect(() => store.setStatus(b.id, "published", "2026-10-10T10:03:00.000Z")).toThrow(/already published/);
    expect(store.get(b.id)?.status).toBe("proposed"); // the failed publish was rolled back
  });

  it("lists newest first, optionally by scheme; unknown id → undefined", () => {
    store.saveProposal(proposal("2.1.0"), "2026-10-10T10:00:00.000Z");
    store.saveProposal({ ...proposal("1.0.0"), rule: { ...getScheme("nsap-widow")!, id: "nsap-old-age", version: "1.0.0" } }, "2026-10-10T11:00:00.000Z");
    expect(store.list().map((r) => r.schemeId)).toEqual(["nsap-old-age", "orunodoi-3"]);
    expect(store.list("orunodoi-3")).toHaveLength(1);
    expect(store.get(999)).toBeUndefined();
  });

  it("resetAll (demo:reset) removes every proposal and published version in one transaction", () => {
    const a = store.saveProposal(proposal("2.1.0"), "2026-10-10T10:00:00.000Z");
    store.setStatus(a.id, "published", "2026-10-10T10:05:00.000Z");
    store.saveProposal(proposal("2.2.0"), "2026-10-10T10:06:00.000Z");
    expect(store.resetAll()).toBe(2);
    expect(store.list()).toEqual([]);
    expect(store.publishedVersions()).toEqual([]);
    expect(store.resetAll()).toBe(0); // idempotent
    // ids start again from 1 (a clean demo), and the store still works
    expect(store.saveProposal(proposal("2.1.0"), "2026-10-10T11:00:00.000Z").id).toBe(1);
  });

  it("persists across connections", () => {
    const { id } = store.saveProposal(proposal("2.1.0"), "2026-10-10T10:00:00.000Z");
    store.setStatus(id, "published", "2026-10-10T10:05:00.000Z");
    store.close();
    store = new RuleStore(join(dir, "rules.db"));
    expect(store.publishedVersions()).toHaveLength(1);
  });
});
