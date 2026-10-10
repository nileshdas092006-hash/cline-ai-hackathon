// Which fields we read or ask for on each document type. Pure.
// Minimum personal data: only what the rule engine uses. Never a full Aadhaar number.
import type { DocType, FieldName } from "./types";

export const DOC_FIELDS: Record<DocType, readonly FieldName[]> = {
  aadhaar: ["name", "dob", "aadhaarLast4"],
  bank_passbook: ["name", "accountNo", "ifsc"],
  land_record: ["ownerNames"],
  ration_card: ["name"],
  // Only the presence of these documents matters to the engine, so nothing is read from them.
  death_certificate: [],
  bpl_proof: [],
  voter_id: ["name"],
  age_proof: ["name", "dob"],
  address_proof: ["name"],
  self_declaration: ["name"],
  income_certificate: ["name"],
  other: ["name"],
};

/**
 * The field that must have a value before a typed-in document counts as added.
 * null = nothing is read from this document; adding it is enough (presence is all the engine checks).
 */
export const MAIN_FIELD: Record<DocType, FieldName | null> = {
  aadhaar: "name",
  bank_passbook: "name",
  land_record: "ownerNames",
  ration_card: "name",
  death_certificate: null,
  bpl_proof: null,
  voter_id: "name",
  age_proof: "name",
  address_proof: "name",
  self_declaration: "name",
  income_certificate: "name",
  other: "name",
};

/** Splits a list of names typed or read as one string ("A; B" or one per line). */
export function splitNames(text: string): string[] {
  return text
    .split(/[;\n]/)
    .map((s) => s.trim().replace(/\s+/g, " "))
    .filter((s) => s !== "");
}
