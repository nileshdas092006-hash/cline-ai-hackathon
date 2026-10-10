// ISO calendar dates (YYYY-MM-DD) without time zones. Pure.

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export interface YMD {
  y: number;
  m: number;
  d: number;
}

/** Parses a real calendar date (rejects 2026-02-30, 2026-13-01, other formats). */
export function parseIsoDate(s: string): YMD | null {
  const m = ISO_DATE.exec(s);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const t = new Date(Date.UTC(y, mo - 1, d));
  if (t.getUTCFullYear() !== y || t.getUTCMonth() !== mo - 1 || t.getUTCDate() !== d) return null;
  return { y, m: mo, d };
}

export function isIsoDate(s: string): boolean {
  return parseIsoDate(s) !== null;
}

/** Throws a RangeError unless `s` is a real YYYY-MM-DD date. */
export function assertIsoDate(s: string, what = "date"): YMD {
  const p = parseIsoDate(s);
  if (!p) throw new RangeError(`${what} must be a real date as YYYY-MM-DD, got "${s}"`);
  return p;
}
