// A readable before/after diff of two rule packs (for the human reviewer). Pure.
// Objects are compared field by field; array items are matched by `id` or `docType` when they
// have one (so reordering is not a change), otherwise by position.
import type { SchemeRule } from "./types";

export interface RuleChange {
  /** e.g. "benefit.overrides[0]", "exclusions[four_wheeler]", "mandatoryDocs[ration_card].fixWhere" */
  path: string;
  kind: "added" | "removed" | "changed";
  before?: unknown;
  after?: unknown;
}

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);

function keyOf(item: unknown): string | null {
  if (!isObj(item)) return null;
  if (typeof item.id === "string") return item.id;
  if (typeof item.docType === "string") return item.docType;
  return null;
}

function same(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function diffArrays(path: string, a: unknown[], b: unknown[], out: RuleChange[]): void {
  const keyed = [...a, ...b].every((x) => keyOf(x) !== null);
  if (!keyed) {
    for (let i = 0; i < Math.max(a.length, b.length); i++) diffValue(`${path}[${i}]`, a[i], b[i], i < a.length, i < b.length, out);
    return;
  }
  const before = new Map(a.map((x) => [keyOf(x)!, x]));
  const after = new Map(b.map((x) => [keyOf(x)!, x]));
  for (const [k, x] of before) diffValue(`${path}[${k}]`, x, after.get(k), true, after.has(k), out);
  for (const [k, x] of after) if (!before.has(k)) out.push({ path: `${path}[${k}]`, kind: "added", after: x });
}

function diffValue(path: string, a: unknown, b: unknown, hasA: boolean, hasB: boolean, out: RuleChange[]): void {
  if (!hasA && hasB) {
    if (b !== undefined) out.push({ path, kind: "added", after: b });
    return;
  }
  if (hasA && !hasB) {
    if (a !== undefined) out.push({ path, kind: "removed", before: a });
    return;
  }
  if (same(a, b)) return;
  if (isObj(a) && isObj(b)) {
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
      diffValue(path ? `${path}.${k}` : k, a[k], b[k], a[k] !== undefined, b[k] !== undefined, out);
    }
    return;
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    diffArrays(path, a, b, out);
    return;
  }
  out.push({ path, kind: "changed", before: a, after: b });
}

/** Changes from `before` (null = a brand-new scheme) to `after`. */
export function diffRules(before: SchemeRule | null, after: SchemeRule): RuleChange[] {
  const out: RuleChange[] = [];
  if (before === null) {
    for (const [k, v] of Object.entries(after)) {
      if (v === undefined || v === null || (Array.isArray(v) && v.length === 0)) continue;
      out.push({ path: k, kind: "added", after: v });
    }
    return out;
  }
  diffValue("", before, after, true, true, out);
  return out;
}
