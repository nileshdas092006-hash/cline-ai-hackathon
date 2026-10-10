import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { jaroWinkler, nameMatch, normalizeName } from "./nameMatch";
import { transliterate } from "./transliterate";

describe("transliterate (basic table)", () => {
  it("turns Devanagari names into Latin", () => {
    expect(transliterate("रमेश कुमार शर्मा")).toBe("RAMESH KUMAR SHARMA");
    expect(transliterate("सुनीता देवी")).toBe("SUNITA DEVI");
    expect(transliterate("श्री")).toBe("SHRI");
  });

  it("turns Assamese/Bengali script names into Latin", () => {
    expect(transliterate("ৰমেশ")).toBe("RAMESH");
    expect(transliterate("সুনীতা দেবী")).toBe("SUNITA DEBI");
    expect(transliterate("শ্ৰীমতী")).toBe("SHRIMATI");
  });

  it("leaves Latin text alone (apart from case)", () => {
    expect(transliterate("Ramesh Kumar")).toBe("RAMESH KUMAR");
  });
});

describe("normalizeName", () => {
  it("uppercases, strips punctuation and extra spaces, drops leading honorifics", () => {
    expect(normalizeName("  smt. Sunita  Devi ")).toBe("SUNITA DEVI");
    expect(normalizeName("Late Shri Ram-Prasad")).toBe("RAM PRASAD");
    expect(normalizeName("MR. R.K. Sharma")).toBe("R K SHARMA");
  });

  it("keeps an honorific-like word that is part of the name (not leading)", () => {
    expect(normalizeName("Sunita Kumari")).toBe("SUNITA KUMARI");
  });

  it("returns an empty string when nothing name-like is left", () => {
    expect(normalizeName("Smt.")).toBe("");
    expect(normalizeName("  ..  ")).toBe("");
  });
});

describe("nameMatch: required cases (docs/schemes.md)", () => {
  const cases: Array<[string, string, string]> = [
    ["Ramesh Kumar", "RAMESH KUMAR ", "same"],
    ["RAMESHKUMAR", "Ramesh Kumar", "same"],
    ["Smt. Sunita Devi", "SUNITA DEBI", "possible_match"],
    ["RAMESH KR SHARMA", "Ramesh Kumar Sharma", "possible_match"],
    ["R. Kumar", "Ramesh Kumar", "initials_only"],
    ["Rameshwar Sharma", "Ramesh Kumar Sharma", "mismatch"],
    ["Ramesh", "Suresh", "mismatch"],
  ];
  it.each(cases)("%s vs %s → %s", (a, b, level) => {
    expect(nameMatch(a, b).level).toBe(level);
  });
});

describe("nameMatch: more cases", () => {
  it("same names score exactly 1", () => {
    expect(nameMatch("Ramesh Kumar", "RAMESH KUMAR").score).toBe(1);
  });

  it("transliteration across scripts is at best a possible_match", () => {
    expect(nameMatch("रमेश कुमार शर्मा", "Ramesh Kumar Sharma").level).toBe("possible_match");
    expect(nameMatch("সুনীতা দেবী", "Sunita Devi").level).toBe("possible_match");
  });

  it("the same non-Latin name is same", () => {
    expect(nameMatch("ৰমেশ শৰ্মা", "ৰমেশ  শৰ্মা").level).toBe("same");
  });

  it("known variants are possible_match", () => {
    expect(nameMatch("Md Rafiqul Islam", "Mohammad Rafiqul Islam").level).toBe("possible_match");
    expect(nameMatch("SK Abdul", "Sheikh Abdul").level).toBe("possible_match");
  });

  it("reordered words are possible_match, never same", () => {
    expect(nameMatch("SHARMA RAMESH KUMAR", "Ramesh Kumar Sharma").level).toBe("possible_match");
  });

  it("multiple initials are initials_only", () => {
    expect(nameMatch("R K Sharma", "Ramesh Kumar Sharma").level).toBe("initials_only");
  });

  it("empty or honorific-only names are a mismatch with score 0", () => {
    expect(nameMatch("", "Ramesh")).toEqual({ level: "mismatch", score: 0 });
    expect(nameMatch("Smt.", "Smt.")).toEqual({ level: "mismatch", score: 0 });
  });
});

describe("jaroWinkler", () => {
  it("is 1 for identical strings and 0 for nothing in common", () => {
    expect(jaroWinkler("MARTHA", "MARTHA")).toBe(1);
    expect(jaroWinkler("ABC", "XYZ")).toBe(0);
  });

  it("matches the textbook value for MARTHA/MARHTA", () => {
    expect(jaroWinkler("MARTHA", "MARHTA")).toBeCloseTo(0.961, 3);
  });
});

const nameTokens = [
  "Ramesh", "RAMESH", "KR", "Kumar", "kumar", "Sharma", "r.", "R", "Devi", "DEBI",
  "Smt.", "Shri", "md", "Mohammad", "SK", "Sheikh", "Suresh", "Rameshwar",
  "रमेश", "कुमार", "দেবী", "ৰমেশ",
];
const nameArb = fc.oneof(
  fc.string(),
  fc.array(fc.constantFrom(...nameTokens), { minLength: 1, maxLength: 4 }).map((t) => t.join(" ")),
);

describe("nameMatch: properties", () => {
  it("a name is same as itself", () => {
    fc.assert(
      fc.property(nameArb, (s) => {
        fc.pre(normalizeName(s) !== "");
        const m = nameMatch(s, s);
        return m.level === "same" && m.score === 1;
      }),
      { numRuns: 500 },
    );
  });

  it("level and score are symmetric", () => {
    fc.assert(
      fc.property(nameArb, nameArb, (a, b) => {
        const ab = nameMatch(a, b);
        const ba = nameMatch(b, a);
        return ab.level === ba.level && ab.score === ba.score;
      }),
      { numRuns: 1000 },
    );
  });

  it("score is always within [0, 1] and only same scores 1 by itself", () => {
    fc.assert(
      fc.property(nameArb, nameArb, (a, b) => {
        const m = nameMatch(a, b);
        return m.score >= 0 && m.score <= 1;
      }),
      { numRuns: 500 },
    );
  });

  it("jaroWinkler is symmetric and within [0, 1]", () => {
    fc.assert(
      fc.property(fc.string(), fc.string(), (a, b) => {
        const x = jaroWinkler(a, b);
        return x === jaroWinkler(b, a) && x >= 0 && x <= 1;
      }),
      { numRuns: 500 },
    );
  });
});
