// The ONLY database writer. Built-in node:sqlite, WAL mode; every write runs inside a transaction.
// Table rule_versions: rule-pack versions proposed by the Rule Maintenance Agent, then published or
// rejected by a person. Built-in packs are version 1 in code and are not stored here.
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { RuleTestCase, TestReport } from "@/core/ruleTests";
import type { SchemeRule } from "@/core/types";

export type RuleVersionStatus = "proposed" | "published" | "rejected";

export interface RuleVersionRow {
  id: number;
  schemeId: string;
  version: string;
  rule: SchemeRule;
  tests: RuleTestCase[];
  testResult: TestReport;
  status: RuleVersionStatus;
  sourceNote: string;
  notice: string;
  summary: string;
  createdAt: string;
  approvedAt: string | null;
}

export interface NewProposal {
  rule: SchemeRule;
  tests: RuleTestCase[];
  testResult: TestReport;
  sourceNote: string;
  notice: string;
  summary: string;
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS rule_versions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  schemeId TEXT NOT NULL,
  version TEXT NOT NULL,
  ruleJson TEXT NOT NULL,
  testsJson TEXT NOT NULL,
  testResultJson TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('proposed', 'published', 'rejected')),
  sourceNote TEXT NOT NULL,
  notice TEXT NOT NULL DEFAULT '',
  summary TEXT NOT NULL DEFAULT '',
  createdAt TEXT NOT NULL,
  approvedAt TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS rule_versions_one_published
  ON rule_versions (schemeId, version) WHERE status = 'published';
`;

interface DbRow {
  id: number;
  schemeId: string;
  version: string;
  ruleJson: string;
  testsJson: string;
  testResultJson: string;
  status: RuleVersionStatus;
  sourceNote: string;
  notice: string;
  summary: string;
  createdAt: string;
  approvedAt: string | null;
}

function fromDb(r: DbRow): RuleVersionRow {
  return {
    id: r.id,
    schemeId: r.schemeId,
    version: r.version,
    rule: JSON.parse(r.ruleJson) as SchemeRule,
    tests: JSON.parse(r.testsJson) as RuleTestCase[],
    testResult: JSON.parse(r.testResultJson) as TestReport,
    status: r.status,
    sourceNote: r.sourceNote,
    notice: r.notice,
    summary: r.summary,
    createdAt: r.createdAt,
    approvedAt: r.approvedAt,
  };
}


export class RuleStore {
  private readonly db: DatabaseSync;

  constructor(path: string) {
    if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec("PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;");
    this.db.exec(SCHEMA);
  }

  /** Runs `fn` in one transaction: all of it is written, or none of it. */
  private tx<T>(fn: () => T): T {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const out = fn();
      this.db.exec("COMMIT");
      return out;
    } catch (e) {
      this.db.exec("ROLLBACK");
      throw e;
    }
  }

  journalMode(): string {
    return (this.db.prepare("PRAGMA journal_mode").get() as { journal_mode: string }).journal_mode;
  }

  saveProposal(p: NewProposal, now: string): RuleVersionRow {
    return this.tx(() => {
      const res = this.db
        .prepare(
          `INSERT INTO rule_versions (schemeId, version, ruleJson, testsJson, testResultJson, status, sourceNote, notice, summary, createdAt)
           VALUES (?, ?, ?, ?, ?, 'proposed', ?, ?, ?, ?)`,
        )
        .run(p.rule.id, p.rule.version, JSON.stringify(p.rule), JSON.stringify(p.tests), JSON.stringify(p.testResult), p.sourceNote, p.notice, p.summary, now);
      return this.mustGet(Number(res.lastInsertRowid));
    });
  }

  /** proposed → published | rejected. Only a proposed row can change; one published row per scheme+version. */
  setStatus(id: number, status: Exclude<RuleVersionStatus, "proposed">, now: string): RuleVersionRow {
    return this.tx(() => {
      const row = this.get(id);
      if (!row) throw new Error(`rule version ${id} not found`);
      if (row.status !== "proposed") throw new Error(`rule version ${id} is ${row.status}, not proposed`);
      if (status === "published") {
        const clash = this.db
          .prepare("SELECT id FROM rule_versions WHERE schemeId = ? AND version = ? AND status = 'published'")
          .get(row.schemeId, row.version);
        if (clash) throw new Error(`${row.schemeId}@${row.version} is already published`);
      }
      this.db.prepare("UPDATE rule_versions SET status = ?, approvedAt = ? WHERE id = ?").run(status, now, id);
      return this.mustGet(id);
    });
  }

  get(id: number): RuleVersionRow | undefined {
    const r = this.db.prepare("SELECT * FROM rule_versions WHERE id = ?").get(id) as DbRow | undefined;
    return r ? fromDb(r) : undefined;
  }

  private mustGet(id: number): RuleVersionRow {
    const row = this.get(id);
    if (!row) throw new Error(`rule version ${id} not found`);
    return row;
  }

  /** Newest first, optionally for one scheme. */
  list(schemeId?: string): RuleVersionRow[] {
    const rows = schemeId
      ? this.db.prepare("SELECT * FROM rule_versions WHERE schemeId = ? ORDER BY createdAt DESC, id DESC").all(schemeId)
      : this.db.prepare("SELECT * FROM rule_versions ORDER BY createdAt DESC, id DESC").all();
    return (rows as unknown as DbRow[]).map(fromDb);
  }

  /** Every published version, oldest approval first (the order to register them in). */
  publishedVersions(): RuleVersionRow[] {
    const rows = this.db.prepare("SELECT * FROM rule_versions WHERE status = 'published' ORDER BY approvedAt ASC, id ASC").all();
    return (rows as unknown as DbRow[]).map(fromDb);
  }

  /**
   * Demo reset: deletes every proposed, published and rejected version, so only the built-in
   * (version 1, in code) rule packs remain. Returns the number of rows removed.
   */
  resetAll(): number {
    return this.tx(() => {
      const res = this.db.prepare("DELETE FROM rule_versions").run();
      // Restart ids at 1 (the table may not have a sequence row yet).
      this.db.prepare("DELETE FROM sqlite_sequence WHERE name = 'rule_versions'").run();
      return Number(res.changes);
    });
  }

  close(): void {
    this.db.close();
  }
}

/** `KAAGAZ_DB_PATH`, or `data/kaagaz.db` under the working directory (git-ignored). */
export function defaultDbPath(env: Record<string, string | undefined> = process.env): string {
  return env.KAAGAZ_DB_PATH?.trim() || join(process.cwd(), "data", "kaagaz.db");
}

let shared: RuleStore | null = null;

/** The app-wide store (one connection per server process). */
export function getStore(): RuleStore {
  shared ??= new RuleStore(defaultDbPath());
  return shared;
}
