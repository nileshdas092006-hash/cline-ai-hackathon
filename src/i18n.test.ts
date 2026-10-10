import { describe, expect, it } from "vitest";
import { DEFAULT_LANG, STRINGS, docTitle, fixWhereLabel, pick } from "./i18n";

function leaves(obj: unknown, path = ""): [string, unknown][] {
  if (obj && typeof obj === "object") {
    return Object.entries(obj as Record<string, unknown>).flatMap(([k, v]) => leaves(v, path ? `${path}.${k}` : k));
  }
  return [[path, obj]];
}

describe("i18n", () => {
  it("defaults to Assamese", () => {
    expect(DEFAULT_LANG).toBe("as");
  });

  it("has the same keys and value types in Assamese and English", () => {
    const en = new Map(leaves(STRINGS.en));
    const as = new Map(leaves(STRINGS.as));
    expect([...as.keys()].sort()).toEqual([...en.keys()].sort());
    for (const [k, v] of en) expect(typeof as.get(k), k).toBe(typeof v);
  });

  it("has no empty strings, and functions return text", () => {
    for (const lang of ["as", "en"] as const) {
      for (const [k, v] of leaves(STRINGS[lang])) {
        const text = typeof v === "function" ? (v as (...a: unknown[]) => string)(2, "x") : v;
        expect(typeof text, `${lang}.${k}`).toBe("string");
        expect((text as string).trim().length, `${lang}.${k}`).toBeGreaterThan(0);
      }
    }
  });

  it("Assamese strings use ৰ (U+09F0), never Bengali র (U+09B0)", () => {
    for (const [k, v] of leaves(STRINGS.as)) {
      const text = typeof v === "function" ? (v as (...a: unknown[]) => string)(2, "x") : String(v);
      expect(text.includes("\u09B0"), k).toBe(false);
    }
  });

  it("reuses the engine labels for documents and places", () => {
    expect(docTitle("en", "bank_passbook")).toBe("Bank passbook");
    expect(docTitle("as", "aadhaar")).toBe("আধাৰ কাৰ্ড");
    expect(fixWhereLabel("en", "bank")).toBe("your bank branch");
    expect(pick("as", "hello", "নমস্কাৰ")).toBe("নমস্কাৰ");
    expect(pick("en", "hello", "নমস্কাৰ")).toBe("hello");
  });
});
