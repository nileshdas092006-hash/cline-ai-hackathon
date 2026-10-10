// Turns the document reader's raw JSON into a strict ExtractedDoc. Pure.
// The model output is untrusted: it is parsed leniently here, then reduced to the fields the engine
// uses. A full Aadhaar number never survives this function (only the last 4 digits).
import { z } from "zod";
import { isIsoDate } from "./dates";
import { DOC_FIELDS, splitNames } from "./docFields";
import { DocType, ExtractedDoc, type FieldName } from "./types";

/** Confidence given to an AI-read field the model did not score (below the 0.8 "confirm" threshold). */
export const DEFAULT_AI_CONFIDENCE = 0.5;
/** Confidence cap for a date of birth that is not a real YYYY-MM-DD date. */
const UNPARSED_DOB_CONFIDENCE = 0.5;

/** What we ask the model to return; deliberately lenient (any key, any value type). */
export const RawExtraction = z.object({
  docType: z.string().optional(),
  fields: z.record(z.string(), z.unknown()).default({}),
  confidence: z.record(z.string(), z.unknown()).default({}),
});
export type RawExtraction = z.infer<typeof RawExtraction>;

const DMY = /^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4})$/;

/** "12/03/1975" → "1975-03-12". Leaves anything it cannot turn into a real date as typed. */
export function normalizeDob(input: string): string {
  const s = input.trim();
  if (isIsoDate(s)) return s;
  const m = DMY.exec(s);
  if (m) {
    const iso = `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
    if (isIsoDate(iso)) return iso;
  }
  return s;
}

/** Keeps only the last 4 digits; undefined when fewer than 4 digits are present. */
export function lastFourDigits(value: unknown): string | undefined {
  if (typeof value !== "string" && typeof value !== "number") return undefined;
  const digits = String(value).replace(/\D/g, "");
  return digits.length >= 4 ? digits.slice(-4) : undefined;
}

function text(value: unknown): string | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value !== "string") return undefined;
  const s = value.trim().replace(/\s+/g, " ");
  return s === "" ? undefined : s;
}

function names(value: unknown): string[] | undefined {
  const list = Array.isArray(value)
    ? value.flatMap((v) => (typeof v === "string" ? splitNames(v) : []))
    : typeof value === "string"
      ? splitNames(value)
      : [];
  return list.length > 0 ? list : undefined;
}

function score(value: unknown): number {
  const n = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  if (!Number.isFinite(n)) return DEFAULT_AI_CONFIDENCE;
  return Math.min(1, Math.max(0, n));
}

function asDocType(value: string | undefined): DocType | null {
  const parsed = DocType.safeParse(value);
  return parsed.success ? parsed.data : value === undefined ? null : "other";
}

export interface Extraction {
  doc: ExtractedDoc;
  /** The type the model thinks it saw (may differ from the slot the user picked). */
  detectedDocType: DocType | null;
}

/**
 * Raw model output → strict ExtractedDoc. When `hintDocType` is given (the slot the user is filling),
 * it wins over the model's guess. Every AI-read field gets a confidence (never "user confirmed").
 */
export function toExtractedDoc(raw: RawExtraction, hintDocType?: DocType): Extraction {
  const detectedDocType = asDocType(raw.docType);
  const docType: DocType = hintDocType ?? detectedDocType ?? "other";
  const f = raw.fields;
  const c = raw.confidence;
  const fields: ExtractedDoc["fields"] = {};
  const confidence: ExtractedDoc["confidence"] = {};

  for (const field of DOC_FIELDS[docType]) {
    let conf = score(c[field]);
    switch (field) {
      case "aadhaarLast4": {
        const v = lastFourDigits(f.aadhaarLast4 ?? f.aadhaarNumber ?? f.aadhaar);
        if (v === undefined) continue;
        fields.aadhaarLast4 = v;
        conf = score(c.aadhaarLast4 ?? c.aadhaarNumber ?? c.aadhaar);
        break;
      }
      case "ownerNames": {
        const v = names(f.ownerNames);
        if (v === undefined) continue;
        fields.ownerNames = v;
        break;
      }
      case "landAreaHectares": {
        const v = typeof f.landAreaHectares === "number" ? f.landAreaHectares : Number(f.landAreaHectares);
        if (!Number.isFinite(v) || v < 0) continue;
        fields.landAreaHectares = v;
        break;
      }
      case "dob": {
        const v = text(f.dob);
        if (v === undefined) continue;
        fields.dob = normalizeDob(v);
        if (!isIsoDate(fields.dob)) conf = Math.min(conf, UNPARSED_DOB_CONFIDENCE);
        break;
      }
      default: {
        const key: Exclude<FieldName, "aadhaarLast4" | "ownerNames" | "landAreaHectares" | "dob"> = field;
        const v = text(f[key]);
        if (v === undefined) continue;
        fields[key] = v;
      }
    }
    confidence[field] = conf;
  }

  return { doc: ExtractedDoc.parse({ docType, fields, confidence }), detectedDocType };
}
