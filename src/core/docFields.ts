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

/** Splits a list of names typed or read as one string ("A; B" or one per line). */
export function splitNames(text: string): string[] {
  return text
    .split(/[;\n]/)
    .map((s) => s.trim().replace(/\s+/g, " "))
    .filter((s) => s !== "");
}
