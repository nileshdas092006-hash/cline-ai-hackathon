// Scheme registry: built-in rule packs plus versions registered at runtime (T3 agent). Pure, in-memory.
// Old versions are kept; getScheme(id) returns the newest.
import { SchemeRule, type Question, type SchemeRuleInput } from "../types";
import { nsapWidow } from "./nsap-widow";
import { orunodoi3 } from "./orunodoi-3";
import { pmKisan } from "./pm-kisan";

const registry = new Map<string, SchemeRule[]>();

/** Compares two x.y.z versions numerically: negative if a < b, 0 if equal, positive if a > b. */
export function compareVersions(a: string, b: string): number {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    if (pa[i] !== pb[i]) return pa[i] - pb[i];
  }
  return 0;
}

/** Validates and adds a scheme version. Throws if invalid or the same id+version exists. */
export function registerScheme(rule: SchemeRuleInput): SchemeRule {
  const parsed = SchemeRule.parse(rule);
  const versions = registry.get(parsed.id) ?? [];
  if (versions.some((v) => v.version === parsed.version)) {
    throw new Error(`scheme ${parsed.id}@${parsed.version} is already registered`);
  }
  versions.push(parsed);
  versions.sort((a, b) => compareVersions(a.version, b.version));
  registry.set(parsed.id, versions);
  return parsed;
}

/** The newest version, or a specific one. */
export function getScheme(id: string, version?: string): SchemeRule | undefined {
  const versions = registry.get(id);
  if (!versions || versions.length === 0) return undefined;
  if (version === undefined) return versions[versions.length - 1];
  return versions.find((v) => v.version === version);
}

/** The newest version of every scheme. */
export function listSchemes(): SchemeRule[] {
  return [...registry.values()].map((v) => v[v.length - 1]);
}

export function listSchemeVersions(id: string): string[] {
  return (registry.get(id) ?? []).map((v) => v.version);
}

/** Every yes/no question the user should answer for a scheme, in display order. */
export function questionsFor(scheme: SchemeRule): Question[] {
  return [
    ...scheme.requirements,
    ...scheme.eligibilityAnyOf,
    ...scheme.exclusions,
    ...scheme.nameChecks.flatMap((n) => (n.familyOwnerQuestion ? [n.familyOwnerQuestion] : [])),
  ];
}

for (const s of [pmKisan, orunodoi3, nsapWidow]) registerScheme(s);
