import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { z } from "zod";
import {
  APP_DESCRIPTION_EN,
  APP_LANG,
  APP_NAME,
  APP_NAME_AS,
  APP_TAGLINE_AS,
  APP_TAGLINE_EN,
  APP_TITLE,
} from "./appInfo";

describe("appInfo (smoke)", () => {
  it("has the exact bilingual title, with intact Assamese script", () => {
    expect(APP_TITLE).toBe("KaagazCheck: কাগজ চেক");
    expect(APP_NAME).toBe("KaagazCheck");
    // "কাগজ": ক া গ জ
    expect(Array.from(APP_NAME_AS)).toEqual([
      "\u0995",
      "\u09BE",
      "\u0997",
      "\u099C",
      " ",
      "\u099A",
      "\u09C7",
      "\u0995",
    ]);
  });

  it("has the English and Assamese taglines", () => {
    expect(APP_TAGLINE_EN).toBe("Check before you apply");
    expect(APP_TAGLINE_AS).toBe("আবেদনৰ আগতে পৰীক্ষা কৰক");
    // Assamese-specific ৰ (U+09F0), not Bengali র
    expect(APP_TAGLINE_AS).toContain("\u09F0");
    expect(APP_TAGLINE_AS).not.toContain("\u09B0");
    expect(z.string().min(20).safeParse(APP_DESCRIPTION_EN).success).toBe(true);
  });

  it("the page language is Assamese", () => {
    expect(APP_LANG).toBe("as");
  });

  it("test tooling works (fast-check property)", () => {
    fc.assert(
      fc.property(fc.string(), (s) => `${s}${APP_TITLE}`.endsWith(APP_TITLE)),
    );
  });
});
