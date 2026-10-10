// Pure helpers for the main flow (documents → confirm fields → questions). No React here.
// Deliberately does not import the engine or the registry, so the client bundle stays small.
import { DOC_FIELDS, MAIN_FIELD, splitNames } from "./docFields";
import { lastFourDigits, normalizeDob } from "./extraction";
import { LOW_CONFIDENCE_THRESHOLD } from "./thresholds";
import type { Answers, DocType, ExtractedDoc, FieldName, Question, SchemeRule } from "./types";

export { DOC_FIELDS, MAIN_FIELD } from "./docFields";

export interface DocSlot {
  docType: DocType;
  /** Mandatory for the scheme; otherwise only used to compare names or read the age. */
  required: boolean;
}

/** Documents to ask for: mandatory ones first, then those used only for name/age checks. */
export function docSlotsFor(scheme: SchemeRule): DocSlot[] {
  const slots: DocSlot[] = scheme.mandatoryDocs.map((d) => ({ docType: d.docType, required: true }));
  const extra: DocType[] = [
    scheme.nameReference,
    ...scheme.nameChecks.map((n) => n.docType),
    ...(scheme.ageRange ? [scheme.ageRange.dobFrom] : []),
  ];
  for (const docType of extra) {
    if (!slots.some((s) => s.docType === docType)) slots.push({ docType, required: false });
  }
  return slots;
}

export function blankDoc(docType: DocType): ExtractedDoc {
  return { docType, fields: {}, confidence: {} };
}

/** True when the reader was unsure about this field and the user has not confirmed it yet. */
export function needsConfirmation(doc: ExtractedDoc, field: FieldName): boolean {
  const c = doc.confidence[field];
  return c !== undefined && c < LOW_CONFIDENCE_THRESHOLD;
}

export function unconfirmedCount(docs: readonly ExtractedDoc[]): number {
  return docs.reduce((n, d) => n + DOC_FIELDS[d.docType].filter((f) => needsConfirmation(d, f)).length, 0);
}

function withoutConfidence(doc: ExtractedDoc, field: FieldName): ExtractedDoc["confidence"] {
  const confidence = { ...doc.confidence };
  delete confidence[field];
  return confidence;
}

/** The user typed `input` into `field`: store it (parsed) and mark it as entered by the user. */
export function setField(doc: ExtractedDoc, field: FieldName, input: string): ExtractedDoc {
  const fields: ExtractedDoc["fields"] = { ...doc.fields };
  const trimmed = input.trim().replace(/[ \t]+/g, " ");
  delete fields[field];
  switch (field) {
    case "aadhaarLast4": {
      const v = lastFourDigits(trimmed);
      if (v !== undefined) fields.aadhaarLast4 = v;
      break;
    }
    case "ownerNames": {
      const v = splitNames(input);
      if (v.length > 0) fields.ownerNames = v;
      break;
    }
    case "landAreaHectares": {
      const v = Number(trimmed);
      if (trimmed !== "" && Number.isFinite(v) && v >= 0) fields.landAreaHectares = v;
      break;
    }
    case "dob":
      if (trimmed !== "") fields.dob = normalizeDob(trimmed);
      break;
    default:
      if (trimmed !== "") fields[field] = trimmed;
  }
  return { ...doc, fields, confidence: withoutConfidence(doc, field) };
}

/** The user checked a low-confidence value and says it is right. */
export function confirmField(doc: ExtractedDoc, field: FieldName): ExtractedDoc {
  return { ...doc, confidence: withoutConfidence(doc, field) };
}

/** The current value as text for an input box. */
export function fieldText(doc: ExtractedDoc, field: FieldName): string {
  const v = doc.fields[field];
  if (v === undefined) return "";
  return Array.isArray(v) ? v.join("\n") : String(v);
}

/** Adds a document, replacing any document of the same type in place. */
export function upsertDoc(docs: readonly ExtractedDoc[], doc: ExtractedDoc): ExtractedDoc[] {
  const i = docs.findIndex((d) => d.docType === doc.docType);
  if (i < 0) return [...docs, doc];
  return docs.map((d, j) => (j === i ? doc : d));
}

export function removeDoc(docs: readonly ExtractedDoc[], docType: DocType): ExtractedDoc[] {
  return docs.filter((d) => d.docType !== docType);
}

/**
 * A document counts as added only once its main field (usually the name) has a value.
 * "Type it in" alone does not count; documents we read nothing from count as soon as they are added.
 */
export function isDocAdded(doc: ExtractedDoc): boolean {
  const field = MAIN_FIELD[doc.docType];
  if (field === null) return true;
  const v = doc.fields[field];
  if (Array.isArray(v)) return v.some((s) => s.trim() !== "");
  if (typeof v === "string") return v.trim() !== "";
  return v !== undefined;
}

/** Only the documents that count as added (what the rule engine and the cover sheet see). */
export function countedDocs(docs: readonly ExtractedDoc[]): ExtractedDoc[] {
  return docs.filter(isDocAdded);
}

/** Only the answers to these questions (use `questionsFor(scheme)`). */
export function relevantAnswers(questions: readonly Question[], answers: Answers): Answers {
  const ids = new Set(questions.map((q) => q.id));
  return Object.fromEntries(Object.entries(answers).filter(([k]) => ids.has(k)));
}
