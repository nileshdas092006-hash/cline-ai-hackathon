// Rules every agent proposal must follow, enforced by code (not by the prompt). Pure.
// - A change to an existing scheme must have a higher version.
// - At least MIN_NEW_TESTS new test cases, with unique ids that don't clash with regression tests.
// - A provenance may only be "verified" if it was already verified (same place, same source) in
//   the current version, or if its sourceUrl appears in the notice text. Anything else must be
//   "provisional", which the engine turns into needs_verification (never a definitive pass/fail).
import type { RuleTestCase } from "./ruleTests";
import { compareVersions } from "./schemes";
import type { RuleProvenance, SchemeRule } from "./types";

export const MIN_NEW_TESTS = 3;

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);

function keyOf(item: unknown, i: number): string {
  if (isObj(item) && typeof item.id === "string") return item.id;
  if (isObj(item) && typeof item.docType === "string") return item.docType;
  return String(i);
}

/** Every provenance in a rule, keyed by a stable path such as "exclusions[four_wheeler].provenance". */
export function provenanceEntries(rule: SchemeRule): Map<string, RuleProvenance> {
  const out = new Map<string, RuleProvenance>();
  const walk = (v: unknown, path: string) => {
    if (Array.isArray(v)) v.forEach((x, i) => walk(x, `${path}[${keyOf(x, i)}]`));
    else if (isObj(v)) {
      for (const [k, x] of Object.entries(v)) {
        const p = path ? `${path}.${k}` : k;
        if (k === "provenance" && isObj(x)) out.set(p, x as unknown as RuleProvenance);
        else walk(x, p);
      }
    }
  };
  walk(rule, "");
  return out;
}

export interface RulePolicyInput {
  rule: SchemeRule;
  /** The current published version of this scheme, or null for a brand-new scheme. */
  current: SchemeRule | null;
  notice: string;
}

export interface TestPolicyInput {
  newTests: readonly RuleTestCase[];
  regressionTestIds: readonly string[];
}

/** Human-readable violations; empty means the proposal follows the rules. */
export function checkProposalPolicy(input: RulePolicyInput & TestPolicyInput): string[] {
  return [...checkRulePolicy(input), ...checkTestPolicy(input)];
}

/** At least MIN_NEW_TESTS new cases, with unique ids that don't clash with the regression tests. */
export function checkTestPolicy({ newTests, regressionTestIds }: TestPolicyInput): string[] {
  const out: string[] = [];
  if (newTests.length < MIN_NEW_TESTS) out.push(`write at least ${MIN_NEW_TESTS} new test cases (got ${newTests.length})`);
  const seen = new Set<string>();
  const regression = new Set(regressionTestIds);
  for (const t of newTests) {
    if (seen.has(t.id)) out.push(`duplicate test id "${t.id}"`);
    seen.add(t.id);
    if (regression.has(t.id)) out.push(`test id "${t.id}" is already a regression test; choose a new id`);
  }
  return out;
}

/** Version must go up; "verified" only when carried over unchanged or cited in the notice. */
export function checkRulePolicy({ rule, current, notice }: RulePolicyInput): string[] {
  const out: string[] = [];

  if (current && compareVersions(rule.version, current.version) <= 0) {
    out.push(`version ${rule.version} must be higher than the current ${current.version} (e.g. bump the minor number)`);
  }

  const before = current ? provenanceEntries(current) : new Map<string, RuleProvenance>();
  for (const [path, p] of provenanceEntries(rule)) {
    if (p.status !== "verified") continue;
    const old = before.get(path);
    const carriedOver = old?.status === "verified" && old.sourceUrl === p.sourceUrl;
    const citedInNotice = p.sourceUrl !== null && notice.includes(p.sourceUrl);
    if (!carriedOver && !citedInNotice) {
      out.push(`${path} is "verified" but its sourceUrl is not in the notice and was not verified before; use "provisional"`);
    }
  }
  return out;
}
