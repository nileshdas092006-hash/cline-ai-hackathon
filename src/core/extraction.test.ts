import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { DEFAULT_AI_CONFIDENCE, RawExtraction, normalizeDob, toExtractedDoc } from "./extraction";
import { ExtractedDoc } from "./types";

const raw = (v: unknown) => RawExtraction.parse(v);

describe("normalizeDob", () => {
  it("keeps ISO dates and converts DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY", () => {
    expect(normalizeDob("1975-03-12")).toBe("1975-03-12");
    expect(normalizeDob("12/03/1975")).toBe("1975-03-12");
    expect(normalizeDob("1-7-1968")).toBe("1968-07-01");
    expect(normalizeDob(" 01.07.1968 ")).toBe("1968-07-01");
  });
  it("leaves unreadable or impossible dates as typed (the engine flags them)", () => {
    expect(normalizeDob("31/02/1975")).toBe("31/02/1975");
    expect(normalizeDob("1975")).toBe("1975");
  });
});

describe("toExtractedDoc", () => {
  it("keeps only the last 4 digits of a full Aadhaar number", () => {
    const { doc } = toExtractedDoc(
      raw({
        docType: "aadhaar",
        fields: { name: "Ramesh Kumar Sharma", dob: "12/03/1975", aadhaarNumber: "1234 5678 4821" },
        confidence: { name: 0.97, dob: 0.95, aadhaarNumber: 0.99 },
      }),
    );
    expect(doc.fields).toEqual({ name: "Ramesh Kumar Sharma", dob: "1975-03-12", aadhaarLast4: "4821" });
    expect(doc.confidence).toEqual({ name: 0.97, dob: 0.95, aadhaarLast4: 0.99 });
    expect(JSON.stringify(doc)).not.toContain("12345678");
    expect(ExtractedDoc.safeParse(doc).success).toBe(true);
  });

  it("gives AI-read fields without a confidence the default (never 'user confirmed')", () => {
    const { doc } = toExtractedDoc(raw({ docType: "bank_passbook", fields: { name: "RAMESH", accountNo: 30012345678, ifsc: "SBIN0001234" } }));
    expect(doc.fields.accountNo).toBe("30012345678");
    expect(doc.confidence).toEqual({ name: DEFAULT_AI_CONFIDENCE, accountNo: DEFAULT_AI_CONFIDENCE, ifsc: DEFAULT_AI_CONFIDENCE });
  });

  it("clamps confidence to 0–1 and lowers it for a DOB that is not a real date", () => {
    const { doc } = toExtractedDoc(raw({ docType: "aadhaar", fields: { name: "A B", dob: "1975" }, confidence: { name: 7, dob: 0.99 } }));
    expect(doc.confidence.name).toBe(1);
    expect(doc.confidence.dob).toBeLessThan(0.8);
  });

  it("uses the hinted doc type but reports what the model saw", () => {
    const r = toExtractedDoc(raw({ docType: "aadhaar", fields: { name: "X Y" } }), "bank_passbook");
    expect(r.doc.docType).toBe("bank_passbook");
    expect(r.detectedDocType).toBe("aadhaar");
    const unknown = toExtractedDoc(raw({ docType: "passport", fields: {} }));
    expect(unknown.doc.docType).toBe("other");
  });

  it("splits owner names, drops empty values and fields the doc type does not need", () => {
    const { doc } = toExtractedDoc(
      raw({
        docType: "land_record",
        fields: { name: "  ", ownerNames: "Rameshwar Sharma; Sita Sharma\n", husbandName: "Somebody", landAreaHectares: 2 },
        confidence: { ownerNames: 0.9 },
      }),
    );
    expect(doc.fields).toEqual({ ownerNames: ["Rameshwar Sharma", "Sita Sharma"] });
    expect(doc.confidence).toEqual({ ownerNames: 0.9 });
  });

  it("reads nothing from documents whose presence is all that matters (minimum personal data)", () => {
    const { doc } = toExtractedDoc(raw({ docType: "death_certificate", fields: { name: "A", husbandName: "B", dob: "1950-01-01" } }));
    expect(doc).toEqual({ docType: "death_certificate", fields: {}, confidence: {} });
  });

  it("drops an Aadhaar value with fewer than 4 digits", () => {
    const { doc } = toExtractedDoc(raw({ docType: "aadhaar", fields: { aadhaarLast4: "12" } }));
    expect(doc.fields.aadhaarLast4).toBeUndefined();
    expect(doc.confidence.aadhaarLast4).toBeUndefined();
  });

  it("property: a 12-digit Aadhaar never survives beyond its last 4 digits", () => {
    fc.assert(
      fc.property(fc.stringMatching(/^\d{12}$/), (aadhaar) => {
        const { doc } = toExtractedDoc(raw({ docType: "aadhaar", fields: { aadhaarNumber: aadhaar, aadhaarLast4: aadhaar } }));
        const json = JSON.stringify(doc);
        expect(json).not.toContain(aadhaar.slice(0, 8));
        expect(doc.fields.aadhaarLast4).toBe(aadhaar.slice(-4));
      }),
    );
  });
});
