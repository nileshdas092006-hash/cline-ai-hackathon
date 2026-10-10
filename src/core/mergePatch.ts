// JSON Merge Patch (RFC 7386). Pure; never modifies its inputs.
// The agent uses it to change an existing rule without re-sending the whole rule.

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);

export function applyMergePatch(target: unknown, patch: unknown): unknown {
  if (!isObj(patch)) return structuredClone(patch);
  const out: Obj = isObj(target) ? structuredClone(target) : {};
  for (const [key, value] of Object.entries(patch)) {
    if (value === null) delete out[key];
    else out[key] = applyMergePatch(out[key], value);
  }
  return out;
}
