import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { z } from "zod";
import {
  APP_NAME,
  APP_NAME_HI,
  APP_TAGLINE_EN,
  APP_TAGLINE_HI,
  APP_TITLE,
} from "./appInfo";

describe("appInfo (smoke)", () => {
  it("has the exact bilingual title, with intact Devanagari", () => {
    expect(APP_TITLE).toBe("KaagazCheck: कागज़ चेक");
    expect(APP_NAME).toBe("KaagazCheck");
    // "कागज़" with nukta: क ा ग ज ़
    expect(Array.from(APP_NAME_HI.normalize("NFD")).slice(0, 5)).toEqual([
      "\u0915",
      "\u093E",
      "\u0917",
      "\u091C",
      "\u093C",
    ]);
  });

  it("taglines are non-empty and the Hindi one is in Devanagari", () => {
    const schema = z.string().min(10);
    expect(schema.safeParse(APP_TAGLINE_EN).success).toBe(true);
    expect(schema.safeParse(APP_TAGLINE_HI).success).toBe(true);
    expect(/[\u0900-\u097F]/.test(APP_TAGLINE_HI)).toBe(true);
  });

  it("test tooling works (fast-check property)", () => {
    fc.assert(
      fc.property(fc.string(), (s) => `${s}${APP_TITLE}`.endsWith(APP_TITLE)),
    );
  });
});
