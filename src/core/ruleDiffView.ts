// Plain-English labels and short value texts for the reviewer's diff (admin UI). Pure, client-safe.

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);

const SEGMENT_LABELS: Record<string, string> = {
  version: "Version",
  nameEn: "Name (English)",
  nameAs: "Name (Assamese)",
  confirmAt: "Where to confirm",
  benefit: "Benefit",
  centralShare: "central share (₹)",
  stateTopUp: "state top-up (₹)",
  period: "period",
  instalments: "instalments",
  effectiveDate: "effective date",
  overrides: "time-limited change",
  mandatoryDocs: "Required documents",
  supportingDocs: "Supporting documents",
  supportingDocsNoteEn: "Supporting documents note (English)",
  supportingDocsNoteAs: "Supporting documents note (Assamese)",
  nameReference: "Name reference document",
  nameChecks: "Name checks",
  fieldChecks: "Field checks",
  ageRange: "Age limit",
  min: "minimum",
  max: "maximum",
  dobFrom: "date of birth from",
  requirements: "Requirements",
  eligibilityAnyOf: "At least one of",
  exclusions: "Exclusions",
  externalChecks: "Confirm outside the app",
  notes: "Notes",
  fixWhere: "where to fix",
  provenance: "source",
  status: "status",
  sourceUrl: "source link",
  sourceTitle: "source title",
  clause: "clause",
  verifiedOn: "checked on",
  textEn: "question (English)",
  textAs: "question (Assamese)",
  labelEn: "label (English)",
  labelAs: "label (Assamese)",
  noteEn: "note (English)",
  noteAs: "note (Assamese)",
};

/** "benefit.overrides[0]" → "Benefit › time-limited change #1". */
export function changeLabel(path: string): string {
  const parts: string[] = [];
  for (const seg of path.split(".")) {
    const m = /^([^[]+)((?:\[[^\]]+\])*)$/.exec(seg);
    const name = m ? m[1] : seg;
    const label = SEGMENT_LABELS[name] ?? name;
    const keys = m?.[2] ? [...m[2].matchAll(/\[([^\]]+)\]/g)].map((k) => k[1]) : [];
    if (keys.length === 0) parts.push(label);
    for (const k of keys) {
      if (/^\d+$/.test(k)) parts.push(`${label} #${Number(k) + 1}`);
      else parts.push(label, k);
    }
  }
  return parts.join(" › ");
}

function source(p: unknown): string {
  return isObj(p) ? `${String(p.status)}: ${String(p.sourceTitle)}` : "";
}

const join = (...xs: (string | false | undefined)[]) => xs.filter(Boolean).join(" · ");

/** A short, readable text for a value in the diff. */
export function formatValue(v: unknown): string {
  if (v === null || v === undefined) return "none";
  if (Array.isArray(v)) return `${v.length} item(s)`;
  if (!isObj(v)) return String(v);
  if ("from" in v && "to" in v) {
    return join(
      `${String(v.from)} → ${String(v.to)}`,
      v.centralShare !== undefined && `central ₹${String(v.centralShare)}`,
      v.stateTopUp !== undefined && `state ${v.stateTopUp === null ? "unconfirmed" : `₹${String(v.stateTopUp)}`}`,
      typeof v.noteEn === "string" && `"${v.noteEn}"`,
      source(v.provenance),
    );
  }
  if ("min" in v && "dobFrom" in v) {
    const years = v.max === undefined ? `${String(v.min)}+ years` : `${String(v.min)}–${String(v.max)} years`;
    return join(`${years} (date of birth from ${String(v.dobFrom)})`, source(v.provenance));
  }
  if ("textEn" in v) return join(`"${String(v.textEn)}"`, source(v.provenance));
  if ("docType" in v) return join(`${String(v.docType)}${v.fixWhere ? ` (from ${String(v.fixWhere)})` : ""}`, source(v.provenance));
  if ("status" in v && "sourceTitle" in v) return join(source(v), typeof v.clause === "string" && `"${v.clause}"`, typeof v.sourceUrl === "string" && v.sourceUrl);
  if ("labelEn" in v) return join(String(v.labelEn), source(v.provenance));
  if ("centralShare" in v) return join(`central ₹${String(v.centralShare)}`, `state ${v.stateTopUp === null ? "unconfirmed" : `₹${String(v.stateTopUp)}`}`, `per ${String(v.period)}`, source(v.provenance));
  return JSON.stringify(v).slice(0, 200);
}
