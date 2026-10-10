import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { applyMergePatch } from "./mergePatch";

describe("applyMergePatch (RFC 7386)", () => {
  it("merges objects recursively, replaces arrays and primitives, and deletes keys set to null", () => {
    const target = { version: "2.0.0", benefit: { stateTopUp: 1250, overrides: [], period: "month" }, notes: [{ id: "a" }], gone: 1 };
    const patch = { version: "2.1.0", benefit: { overrides: [{ from: "2026-10-01" }] }, notes: [], gone: null };
    expect(applyMergePatch(target, patch)).toEqual({
      version: "2.1.0",
      benefit: { stateTopUp: 1250, overrides: [{ from: "2026-10-01" }], period: "month" },
      notes: [],
    });
  });

  it("does not modify its inputs", () => {
    const target = { a: { b: 1 } };
    const patch = { a: { c: 2 } };
    applyMergePatch(target, patch);
    expect(target).toEqual({ a: { b: 1 } });
    expect(patch).toEqual({ a: { c: 2 } });
  });

  it("a non-object patch replaces the target", () => {
    expect(applyMergePatch({ a: 1 }, [1, 2])).toEqual([1, 2]);
    expect(applyMergePatch({ a: 1 }, "x")).toBe("x");
  });

  it("property: an empty patch changes nothing", () => {
    fc.assert(
      fc.property(fc.dictionary(fc.string(), fc.jsonValue()), (t) => {
        expect(applyMergePatch(t, {})).toEqual(t);
      }),
    );
  });
});
