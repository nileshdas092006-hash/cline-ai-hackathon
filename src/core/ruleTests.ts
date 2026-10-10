// Regression test cases for rule packs, and a deterministic runner. Pure.
// A case is data (written by a person or proposed by the agent); pass/fail is decided here, by code.
import { z } from "zod";
import { benefitOn } from "./benefit";
import { evaluate } from "./evaluate";
import { Answers, CheckResult, Eligibility, ExtractedDoc, IsoDate, Readiness, type SchemeRule } from "./types";

const CASE_ID = z.string().regex(/^[a-z0-9][a-z0-9_-]*$/, "use lowercase letters, digits, _ or -").max(64);

export const BenefitExpectation = z
  .object({
    centralShare: z.number().nonnegative(),
    stateTopUp: z.number().nonnegative().nullable(),
    total: z.number().nonnegative().nullable(),
    period: z.enum(["month", "year"]),
    isOverride: z.boolean(),
  })
  .partial()
  .strict()
  .refine((e) => Object.keys(e).length > 0, { message: "expect at least one value" });

export const EvaluateExpectation = z
  .object({
    eligibility: Eligibility,
    readiness: Readiness,
    /** Check id → expected result, e.g. { "age": "ok", "doc_bpl_proof": "action_required" }. */
    checks: z.record(z.string().min(1), CheckResult),
  })
  .partial()
  .strict()
  .refine((e) => Object.keys(e).length > 0, { message: "expect at least one value" });

export const BenefitTestCase = z
  .object({
    kind: z.literal("benefit"),
    id: CASE_ID,
    description: z.string().min(1).max(200),
    date: IsoDate,
    expect: BenefitExpectation,
  })
  .strict();

export const EvaluateTestCase = z
  .object({
    kind: z.literal("evaluate"),
    id: CASE_ID,
    description: z.string().min(1).max(200),
    asOfDate: IsoDate,
    docs: z.array(ExtractedDoc).max(12),
    answers: Answers,
    expect: EvaluateExpectation,
  })
  .strict();

export const RuleTestCase = z.discriminatedUnion("kind", [BenefitTestCase, EvaluateTestCase]);
export type RuleTestCase = z.infer<typeof RuleTestCase>;

/** `new`: written for this proposal. `regression`: already accepted for the scheme. */
export type TestOrigin = "new" | "regression";

export interface TestCaseResult {
  id: string;
  description: string;
  kind: RuleTestCase["kind"];
  origin: TestOrigin;
  passed: boolean;
  failures: string[];
}

export interface TestReport {
  total: number;
  passed: number;
  failed: number;
  results: TestCaseResult[];
}

const show = (v: unknown) => (v === undefined ? "nothing" : JSON.stringify(v).replace(/^"(.*)"$/, "$1"));

function compare(expected: Record<string, unknown>, actual: Record<string, unknown>): string[] {
  const out: string[] = [];
  for (const [key, want] of Object.entries(expected)) {
    if (actual[key] !== want) out.push(`${key}: expected ${show(want)}, got ${show(actual[key])}`);
  }
  return out;
}

function runOne(scheme: SchemeRule, test: RuleTestCase): string[] {
  try {
    if (test.kind === "benefit") {
      const b = benefitOn(scheme, test.date);
      return compare(test.expect, { ...b });
    }
    const report = evaluate(scheme, test.docs, test.answers, test.asOfDate);
    const { checks: wantChecks, ...verdicts } = test.expect;
    const failures = compare(verdicts, { eligibility: report.eligibility, readiness: report.readiness });
    for (const [id, want] of Object.entries(wantChecks ?? {})) {
      const got = report.checks.find((c) => c.id === id);
      if (!got) failures.push(`check "${id}": not in the report (has: ${report.checks.map((c) => c.id).join(", ")})`);
      else if (got.result !== want) failures.push(`check "${id}": expected ${want}, got ${got.result}`);
    }
    return failures;
  } catch (e) {
    return [`error: ${e instanceof Error ? e.message : String(e)}`];
  }
}

/** Runs every case against `scheme`. Deterministic: the same inputs always give the same report. */
export function runRuleTests(scheme: SchemeRule, cases: readonly { test: RuleTestCase; origin: TestOrigin }[]): TestReport {
  const results = cases.map(({ test, origin }): TestCaseResult => {
    const failures = runOne(scheme, test);
    return { id: test.id, description: test.description, kind: test.kind, origin, passed: failures.length === 0, failures };
  });
  const passed = results.filter((r) => r.passed).length;
  return { total: results.length, passed, failed: results.length - passed, results };
}
