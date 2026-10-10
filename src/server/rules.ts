// Rule versions: validate → test → save as proposed → a person publishes or rejects.
// All checks are code (zod schema, proposal policy, the rule engine). Writes go through store.ts only.
// Published versions are registered in the in-memory scheme registry, so the citizen flow uses
// them at once; syncRegistry() also picks up versions published by another server process.
import { z } from "zod";
import { applyMergePatch } from "@/core/mergePatch";
import { checkRulePolicy, checkTestPolicy } from "@/core/rulePolicy";
import { RuleTestCase, runRuleTests, type TestReport } from "@/core/ruleTests";
import { getScheme, registerScheme, resetRegistry, runtimeVersionKeys } from "@/core/schemes";
import { BUILTIN_REGRESSION_TESTS } from "@/core/schemes/regression";
import { SchemeRule } from "@/core/types";
import { getStore, type RuleStore, type RuleVersionRow } from "./store";

export type Failure = { ok: false; errors: string[] };
type Checked = { ok: true; rule: SchemeRule; tests: RuleTestCase[]; report: TestReport };
const MAX_ERRORS = 25;

/** "path: message" lines, at most MAX_ERRORS. */
export function zodErrors(error: z.ZodError, prefix = ""): string[] {
  return error.issues.slice(0, MAX_ERRORS).map((i) => {
    const path = [prefix, ...i.path.map(String)].filter(Boolean).join(".");
    return `${path || "(root)"}: ${i.message}`;
  });
}

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

export interface ProposalInput {
  rule: unknown;
  tests: unknown;
  sourceNote: string;
  notice: string;
  summary: string;
}

export class RuleService {
  constructor(
    private readonly store: RuleStore,
    private readonly now: () => string = () => new Date().toISOString(),
  ) {}

  /**
   * Registers every published version that the registry does not know yet. Idempotent.
   * If the registry holds a version that is no longer published (after `npm run demo:reset`),
   * it is rebuilt from the built-in packs first, so a running server drops it too.
   */
  syncRegistry(): void {
    const published = this.store.publishedVersions();
    const live = new Set(published.map((r) => `${r.schemeId}@${r.version}`));
    if (runtimeVersionKeys().some((k) => !live.has(k))) resetRegistry();
    for (const row of published) {
      if (!getScheme(row.schemeId, row.version)) registerScheme(row.rule);
    }
  }

  /** The live (newest published) version of a scheme. */
  currentRule(schemeId: string): SchemeRule | undefined {
    this.syncRegistry();
    return getScheme(schemeId);
  }

  /** Tests every new version must pass: the built-in ones + those of every published version. */
  regressionTests(schemeId: string): RuleTestCase[] {
    const published = this.store.publishedVersions().filter((r) => r.schemeId === schemeId);
    return [...(BUILTIN_REGRESSION_TESTS[schemeId] ?? []), ...published.flatMap((r) => r.tests)];
  }

  /** A full rule, or a JSON merge patch applied to the live version of `schemeId`. */
  candidate(input: { schemeId?: string; rule?: unknown; patch?: unknown }): { ok: true; value: unknown } | Failure {
    if (input.rule !== undefined) return { ok: true, value: input.rule };
    if (input.patch === undefined) return { ok: false, errors: ["give either `rule` (a full SchemeRule) or `patch` with `schemeId`"] };
    const base = input.schemeId ? this.currentRule(input.schemeId) : undefined;
    if (!base) return { ok: false, errors: [`a patch needs an existing schemeId; "${input.schemeId ?? ""}" is unknown`] };
    return { ok: true, value: applyMergePatch(base, input.patch) };
  }

  /** zod schema + policy (version bump, provenance). */
  validate(input: unknown, notice: string): { ok: true; rule: SchemeRule; current: SchemeRule | null } | Failure {
    const parsed = SchemeRule.safeParse(input);
    if (!parsed.success) return { ok: false, errors: zodErrors(parsed.error) };
    const current = this.currentRule(parsed.data.id) ?? null;
    const errors = checkRulePolicy({ rule: parsed.data, current, notice });
    return errors.length ? { ok: false, errors } : { ok: true, rule: parsed.data, current };
  }

  /** Runs the new cases and every regression test of the scheme through the engine. */
  runTests(ruleInput: unknown, testsInput: unknown): Checked | Failure {
    const rule = SchemeRule.safeParse(ruleInput);
    if (!rule.success) return { ok: false, errors: zodErrors(rule.error, "rule") };
    const tests = z.array(RuleTestCase).max(30).safeParse(testsInput);
    if (!tests.success) return { ok: false, errors: zodErrors(tests.error, "tests") };
    const cases = [
      ...tests.data.map((test) => ({ test, origin: "new" as const })),
      ...this.regressionTests(rule.data.id).map((test) => ({ test, origin: "regression" as const })),
    ];
    return { ok: true, rule: rule.data, tests: tests.data, report: runRuleTests(rule.data, cases) };
  }

  /** Every check, in order. Used before saving and again before publishing. */
  private check(p: Pick<ProposalInput, "rule" | "tests" | "notice">): Checked | Failure {
    const valid = this.validate(p.rule, p.notice);
    if (!valid.ok) return valid;
    const run = this.runTests(valid.rule, p.tests);
    if (!run.ok) return run;
    const errors = checkTestPolicy({ newTests: run.tests, regressionTestIds: this.regressionTests(valid.rule.id).map((t) => t.id) });
    for (const r of run.report.results.filter((x) => !x.passed)) errors.push(`test "${r.id}" (${r.origin}) fails: ${r.failures.join("; ")}`);
    return errors.length ? { ok: false, errors } : run;
  }

  /** Stores a proposal (status `proposed`) only if it is valid and every test passes. Not live until published. */
  saveProposal(p: ProposalInput): { ok: true; row: RuleVersionRow } | Failure {
    const res = this.check(p);
    if (!res.ok) return res;
    const row = this.store.saveProposal(
      { rule: res.rule, tests: res.tests, testResult: res.report, sourceNote: p.sourceNote.slice(0, 500), notice: p.notice, summary: p.summary.slice(0, 1000) },
      this.now(),
    );
    return { ok: true, row };
  }

  /** A person approved it: re-check (the live version may have moved on), then make it live. */
  publish(id: number): { ok: true; row: RuleVersionRow } | Failure {
    const row = this.store.get(id);
    if (!row) return { ok: false, errors: [`rule version ${id} not found`] };
    if (row.status !== "proposed") return { ok: false, errors: [`rule version ${id} is ${row.status}, not proposed`] };
    const res = this.check({ rule: row.rule, tests: row.tests, notice: row.notice });
    if (!res.ok) return res;
    try {
      const published = this.store.setStatus(id, "published", this.now());
      registerScheme(published.rule);
      return { ok: true, row: published };
    } catch (e) {
      return { ok: false, errors: [message(e)] };
    }
  }

  reject(id: number): { ok: true; row: RuleVersionRow } | Failure {
    try {
      return { ok: true, row: this.store.setStatus(id, "rejected", this.now()) };
    } catch (e) {
      return { ok: false, errors: [message(e)] };
    }
  }

  history(schemeId?: string): RuleVersionRow[] {
    return this.store.list(schemeId);
  }

  get(id: number): RuleVersionRow | undefined {
    return this.store.get(id);
  }
}

let shared: RuleService | null = null;

/** The app-wide service, with published versions loaded into the registry. */
export function getRuleService(): RuleService {
  shared ??= new RuleService(getStore());
  shared.syncRegistry();
  return shared;
}

