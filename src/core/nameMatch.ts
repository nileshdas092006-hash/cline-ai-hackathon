// Defensive name consistency (docs/schemes.md, "Name consistency"). Pure.
// Levels: same > possible_match > initials_only > mismatch. Only `same` may ever become an `ok` check.
import { transliterate } from "./transliterate";
import type { NameMatchResult } from "./types";

/** Dropped only when they lead the name ("Late Shri Ram" → "RAM"; "Sunita Kumari" keeps KUMARI). */
const HONORIFICS = new Set([
  "SHRI", "SHREE", "SRI", "SMT", "SHRIMATI", "SRIMATI", "MR", "MRS", "MS", "MISS",
  "KUMARI", "KUM", "SUSHRI", "LATE",
]);

/** Known abbreviations and spelling variants → one canonical token. */
const VARIANTS: Record<string, string> = {
  KR: "KUMAR", KMR: "KUMAR",
  MD: "MOHAMMAD", MOHD: "MOHAMMAD", MOHAMMED: "MOHAMMAD", MUHAMMAD: "MOHAMMAD", MOHAMAD: "MOHAMMAD", MOHAMED: "MOHAMMAD",
  DEBI: "DEVI",
  SK: "SHEIKH", SHAIKH: "SHEIKH", SHEK: "SHEIKH", SHEKH: "SHEIKH", SHAIK: "SHEIKH",
  PD: "PRASAD", PRASHAD: "PRASAD",
};

/** Jaro-Winkler ≥ this on every word pair → possible_match. */
export const POSSIBLE_MATCH_THRESHOLD = 0.85;

interface Token {
  raw: string; // original script, uppercased
  latin: string; // transliterated
}

function tokenize(name: string): Token[] {
  const tokens = name
    .normalize("NFC")
    .split(/[^\p{L}\p{M}\p{N}]+/u)
    .filter((t) => t.length > 0)
    .map((t) => ({ raw: t.toUpperCase(), latin: transliterate(t) }))
    .filter((t) => t.latin.length > 0);
  let start = 0;
  while (start < tokens.length && HONORIFICS.has(tokens[start].latin)) start++;
  return tokens.slice(start);
}

/** Uppercase Latin form: leading honorifics dropped, punctuation removed, scripts transliterated. */
export function normalizeName(name: string): string {
  return tokenize(name)
    .map((t) => t.latin)
    .join(" ");
}

const canonical = (latin: string): string => VARIANTS[latin] ?? latin;

function jaro(s1: string, s2: string): number {
  if (s1 === s2) return 1;
  if (s1.length === 0 || s2.length === 0) return 0;
  const window = Math.max(0, Math.floor(Math.max(s1.length, s2.length) / 2) - 1);
  const m1 = new Array<boolean>(s1.length).fill(false);
  const m2 = new Array<boolean>(s2.length).fill(false);
  let matches = 0;
  for (let i = 0; i < s1.length; i++) {
    const lo = Math.max(0, i - window);
    const hi = Math.min(s2.length - 1, i + window);
    for (let j = lo; j <= hi; j++) {
      if (!m2[j] && s1[i] === s2[j]) {
        m1[i] = true;
        m2[j] = true;
        matches++;
        break;
      }
    }
  }
  if (matches === 0) return 0;
  let k = 0;
  let halfTranspositions = 0;
  for (let i = 0; i < s1.length; i++) {
    if (!m1[i]) continue;
    while (!m2[k]) k++;
    if (s1[i] !== s2[k]) halfTranspositions++;
    k++;
  }
  const t = halfTranspositions / 2;
  return (matches / s1.length + matches / s2.length + (matches - t) / matches) / 3;
}

/** Jaro-Winkler similarity in [0, 1]; symmetric by construction (arguments are ordered first). */
export function jaroWinkler(a: string, b: string): number {
  const [s1, s2] = a <= b ? [a, b] : [b, a];
  const j = jaro(s1, s2);
  let prefix = 0;
  while (prefix < 4 && prefix < s1.length && prefix < s2.length && s1[prefix] === s2[prefix]) prefix++;
  return Math.min(1, j + prefix * 0.1 * (1 - j));
}

const round3 = (x: number) => Math.round(x * 1000) / 1000;
const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;

/** Word-level similarity shown to the user for transparency (never a decision by itself). */
function wordScore(a: string[], b: string[]): number {
  if (a.length === b.length) {
    const inOrder = mean(a.map((t, i) => jaroWinkler(t, b[i])));
    const sa = [...a].sort();
    const sb = [...b].sort();
    const sorted = mean(sa.map((t, i) => jaroWinkler(t, sb[i])));
    return Math.max(inOrder, sorted);
  }
  // Different word counts: greedy best pairing of the shorter list, divided by the longer length.
  const [short, long] = a.length < b.length ? [a, b] : [b, a];
  const used = new Array<boolean>(long.length).fill(false);
  let total = 0;
  for (const t of short) {
    let best = -1;
    let bestScore = 0;
    long.forEach((u, i) => {
      const s = jaroWinkler(t, u);
      if (!used[i] && s > bestScore) {
        best = i;
        bestScore = s;
      }
    });
    if (best >= 0) {
      used[best] = true;
      total += bestScore;
    }
  }
  return total / long.length;
}

const isInitialOf = (x: string, y: string) => x.length === 1 && y.length > 1 && y.startsWith(x);

/** Same word count; at least one word is an initial of the other's word; the rest agree. */
function initialsOnly(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  let initials = 0;
  for (let i = 0; i < a.length; i++) {
    if (isInitialOf(a[i], b[i]) || isInitialOf(b[i], a[i])) initials++;
    else if (a[i] !== b[i] && jaroWinkler(a[i], b[i]) < POSSIBLE_MATCH_THRESHOLD) return false;
  }
  return initials > 0;
}

/**
 * Compares two names.
 * - same: identical after formatting normalisation (case, punctuation, spaces, joined words, leading honorifics)
 * - possible_match: differs only by abbreviations/variants, transliteration, word order,
 *   or every word pair has Jaro-Winkler ≥ 0.85
 * - initials_only: some words are only initials of the other name's words
 * - mismatch: anything else (including a missing or extra word, or an empty name)
 */
export function nameMatch(a: string, b: string): NameMatchResult {
  const ta = tokenize(a);
  const tb = tokenize(b);
  if (ta.length === 0 || tb.length === 0) return { level: "mismatch", score: 0 };

  const rawA = ta.map((t) => t.raw).join("");
  const rawB = tb.map((t) => t.raw).join("");
  if (rawA === rawB) return { level: "same", score: 1 };

  const ca = ta.map((t) => canonical(t.latin));
  const cb = tb.map((t) => canonical(t.latin));
  // Never report 1 for something that is not `same`.
  const score = Math.min(0.999, round3(wordScore(ca, cb)));

  if (ca.join("") === cb.join("")) return { level: "possible_match", score };
  if (ca.length === cb.length && [...ca].sort().join(" ") === [...cb].sort().join(" ")) {
    return { level: "possible_match", score };
  }
  if (initialsOnly(ca, cb)) return { level: "initials_only", score };
  if (ca.length === cb.length && ca.every((t, i) => jaroWinkler(t, cb[i]) >= POSSIBLE_MATCH_THRESHOLD)) {
    return { level: "possible_match", score };
  }
  return { level: "mismatch", score };
}

const LEVEL_RANK: Record<NameMatchResult["level"], number> = {
  same: 3,
  possible_match: 2,
  initials_only: 1,
  mismatch: 0,
};

/** The best match of `name` against several candidates (e.g. land-record co-owners). */
export function bestNameMatch(name: string, candidates: readonly string[]): NameMatchResult {
  let best: NameMatchResult = { level: "mismatch", score: 0 };
  for (const c of candidates) {
    const m = nameMatch(name, c);
    if (LEVEL_RANK[m.level] > LEVEL_RANK[best.level] || (m.level === best.level && m.score > best.score)) best = m;
  }
  return best;
}

