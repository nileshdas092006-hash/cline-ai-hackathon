import { describe, expect, it } from "vitest";
import {
  DOC_FIELDS,
  MAIN_FIELD,
  blankDoc,
  confirmField,
  countedDocs,
  docSlotsFor,
  fieldText,
  isDocAdded,
  needsConfirmation,
  relevantAnswers,
  removeDoc,
  setField,
  unconfirmedCount,
  upsertDoc,
} from "./flow";
import { getScheme, questionsFor } from "./schemes";
import { ExtractedDoc, type SchemeRule } from "./types";

function scheme(id: string): SchemeRule {
  const s = getScheme(id);
  if (!s) throw new Error(id);
  return s;
}

describe("docSlotsFor", () => {
  it("lists mandatory documents first, then documents used only for name checks", () => {
    expect(docSlotsFor(scheme("pm-kisan"))).toEqual([
      { docType: "aadhaar", required: true },
      { docType: "bank_passbook", required: true },
      { docType: "land_record", required: true },
    ]);
    expect(docSlotsFor(scheme("orunodoi-3"))).toEqual([
      { docType: "ration_card", required: true },
      { docType: "aadhaar", required: false },
      { docType: "bank_passbook", required: false },
    ]);
    expect(docSlotsFor(scheme("nsap-widow")).map((s) => s.docType)).toEqual([
      "aadhaar",
      "death_certificate",
      "bank_passbook",
      "bpl_proof",
    ]);
  });
});

describe("field editing", () => {
  const aadhaar: ExtractedDoc = {
    docType: "aadhaar",
    fields: { name: "Ramesh Kumar Sharma", dob: "1975-03-12", aadhaarLast4: "4821" },
    confidence: { name: 0.6, dob: 0.95, aadhaarLast4: 0.99 },
  };

  it("never offers a full Aadhaar field", () => {
    for (const fields of Object.values(DOC_FIELDS)) expect(fields).not.toContain("aadhaarNumber");
    expect(DOC_FIELDS.aadhaar).toContain("aadhaarLast4");
  });

  it("flags only fields read with low confidence", () => {
    expect(needsConfirmation(aadhaar, "name")).toBe(true);
    expect(needsConfirmation(aadhaar, "dob")).toBe(false);
    expect(unconfirmedCount([aadhaar])).toBe(1);
  });

  it("editing a field stores the value and marks it confirmed by the user", () => {
    const d = setField(aadhaar, "name", "  Ramesh K Sharma ");
    expect(d.fields.name).toBe("Ramesh K Sharma");
    expect(d.confidence.name).toBeUndefined();
    expect(aadhaar.fields.name).toBe("Ramesh Kumar Sharma"); // immutable
    expect(ExtractedDoc.safeParse(d).success).toBe(true);
  });

  it("confirming keeps the value and removes the low-confidence flag", () => {
    const d = confirmField(aadhaar, "name");
    expect(d.fields.name).toBe("Ramesh Kumar Sharma");
    expect(needsConfirmation(d, "name")).toBe(false);
  });

  it("empty input removes the field", () => {
    const d = setField(aadhaar, "dob", "   ");
    expect(d.fields.dob).toBeUndefined();
    expect(d.confidence.dob).toBeUndefined();
  });

  it("Aadhaar input keeps only the last 4 digits, and nothing until 4 digits are typed", () => {
    expect(setField(blankDoc("aadhaar"), "aadhaarLast4", "48").fields.aadhaarLast4).toBeUndefined();
    expect(setField(blankDoc("aadhaar"), "aadhaarLast4", "1234 5678 9012").fields.aadhaarLast4).toBe("9012");
  });

  it("owner names are one per line (or separated by ;)", () => {
    const d = setField(blankDoc("land_record"), "ownerNames", "Rameshwar Sharma\n\n Sita Sharma ; Hari");
    expect(d.fields.ownerNames).toEqual(["Rameshwar Sharma", "Sita Sharma", "Hari"]);
    expect(fieldText(d, "ownerNames")).toBe("Rameshwar Sharma\nSita Sharma\nHari");
  });
});

describe("doc list helpers", () => {
  it("upsert replaces a document of the same type and keeps order", () => {
    const a = blankDoc("aadhaar");
    const b = blankDoc("bank_passbook");
    const a2 = setField(a, "name", "X Y");
    const list = upsertDoc(upsertDoc([a, b], a2), blankDoc("land_record"));
    expect(list.map((d) => d.docType)).toEqual(["aadhaar", "bank_passbook", "land_record"]);
    expect(list[0].fields.name).toBe("X Y");
    expect(removeDoc(list, "bank_passbook").map((d) => d.docType)).toEqual(["aadhaar", "land_record"]);
  });

  it("a typed-in document counts as added only once its main field has a value", () => {
    expect(MAIN_FIELD.aadhaar).toBe("name");
    expect(MAIN_FIELD.land_record).toBe("ownerNames");
    expect(isDocAdded(blankDoc("aadhaar"))).toBe(false);
    expect(isDocAdded(setField(blankDoc("aadhaar"), "dob", "12/03/1975"))).toBe(false); // not the main field
    expect(isDocAdded(setField(blankDoc("aadhaar"), "name", "   "))).toBe(false);
    expect(isDocAdded(setField(blankDoc("aadhaar"), "name", "Ramesh Kumar Sharma"))).toBe(true);
    expect(isDocAdded(blankDoc("land_record"))).toBe(false);
    expect(isDocAdded(setField(blankDoc("land_record"), "ownerNames", "Ramesh Kumar Sharma"))).toBe(true);
  });

  it("documents we read nothing from count as soon as they are added (presence is all that matters)", () => {
    expect(MAIN_FIELD.death_certificate).toBeNull();
    expect(MAIN_FIELD.bpl_proof).toBeNull();
    expect(isDocAdded(blankDoc("death_certificate"))).toBe(true);
    expect(isDocAdded(blankDoc("bpl_proof"))).toBe(true);
  });

  it("every doc type's main field is one of the fields we ask for", () => {
    for (const [docType, field] of Object.entries(MAIN_FIELD)) {
      const fields = DOC_FIELDS[docType as keyof typeof DOC_FIELDS];
      if (field === null) expect(fields).toEqual([]);
      else expect(fields).toContain(field);
    }
  });

  it("countedDocs drops empty typed-in documents, so the engine reports them as missing", () => {
    const docs = [setField(blankDoc("aadhaar"), "name", "Sunita Devi"), blankDoc("bank_passbook"), blankDoc("death_certificate")];
    expect(countedDocs(docs).map((d) => d.docType)).toEqual(["aadhaar", "death_certificate"]);
  });

  it("relevantAnswers keeps only this scheme's questions", () => {
    expect(relevantAnswers(questionsFor(scheme("nsap-widow")), { is_widow: true, income_tax_payer: false })).toEqual({
      is_widow: true,
    });
  });
});
