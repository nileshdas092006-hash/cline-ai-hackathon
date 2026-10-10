// Demo sample sets (clearly FAKE people and numbers). Pure data, validated by zod.
// A = clean PM-KISAN farmer → ready_for_review (+ bank seeding needs verification)
// B = PM-KISAN: bank "RAMESH KR SHARMA" (possible match) + land "Rameshwar Sharma" (mismatch) → action_required
// C = widow pension, missing death certificate → action_required
import { z } from "zod";
import { Answers, ExtractedDoc } from "./types";

export const SampleSet = z.object({
  id: z.enum(["A", "B", "C"]),
  schemeId: z.string(),
  titleEn: z.string(),
  titleAs: z.string(),
  docs: z.array(ExtractedDoc),
  answers: Answers,
});
export type SampleSet = z.infer<typeof SampleSet>;

const pmKisanNo = {
  holds_constitutional_post: false,
  govt_employee: false,
  income_tax_payer: false,
  practising_professional: false,
  pension_10k_plus: false,
};

const aadhaarRamesh: ExtractedDoc = {
  docType: "aadhaar",
  fields: { name: "Ramesh Kumar Sharma", dob: "1975-03-12", aadhaarLast4: "4821" },
  confidence: { name: 0.97, dob: 0.95, aadhaarLast4: 0.99 },
};

export const SAMPLES: Record<SampleSet["id"], SampleSet> = {
  A: SampleSet.parse({
    id: "A",
    schemeId: "pm-kisan",
    titleEn: "Sample A: PM-KISAN, papers in order (fake)",
    titleAs: "নমুনা A: পি এম কিষাণ, কাগজ ঠিকে আছে (নকল)",
    docs: [
      aadhaarRamesh,
      {
        docType: "bank_passbook",
        fields: { name: "RAMESH KUMAR SHARMA", accountNo: "30012345678", ifsc: "SBIN0001234" },
        confidence: { name: 0.95, accountNo: 0.93, ifsc: 0.96 },
      },
      {
        docType: "land_record",
        fields: { ownerNames: ["Ramesh Kumar Sharma"] },
        confidence: { ownerNames: 0.9 },
      },
    ],
    answers: pmKisanNo,
  }),
  B: SampleSet.parse({
    id: "B",
    schemeId: "pm-kisan",
    titleEn: "Sample B: PM-KISAN, names do not match (fake)",
    titleAs: "নমুনা B: পি এম কিষাণ, নাম নিমিলে (নকল)",
    docs: [
      aadhaarRamesh,
      {
        docType: "bank_passbook",
        fields: { name: "RAMESH KR SHARMA", accountNo: "30012345678", ifsc: "SBIN0001234" },
        confidence: { name: 0.95, accountNo: 0.93, ifsc: 0.96 },
      },
      {
        docType: "land_record",
        fields: { ownerNames: ["Rameshwar Sharma"] },
        confidence: { ownerNames: 0.9 },
      },
    ],
    answers: pmKisanNo,
  }),
  C: SampleSet.parse({
    id: "C",
    schemeId: "nsap-widow",
    titleEn: "Sample C: Widow pension, death certificate missing (fake)",
    titleAs: "নমুনা C: বিধৱা পেঞ্চন, মৃত্যুৰ প্ৰমাণপত্ৰ নাই (নকল)",
    docs: [
      {
        docType: "aadhaar",
        fields: { name: "Smt. Sunita Devi", dob: "1968-07-01", aadhaarLast4: "7315" },
        confidence: { name: 0.96, dob: 0.94, aadhaarLast4: 0.99 },
      },
      {
        docType: "bank_passbook",
        fields: { name: "SUNITA DEVI", accountNo: "40098765432", ifsc: "UTBI0ABC123" },
        confidence: { name: 0.94, accountNo: 0.92, ifsc: 0.95 },
      },
      {
        docType: "bpl_proof",
        fields: { name: "Sunita Devi" },
        confidence: { name: 0.9 },
      },
    ],
    answers: { is_widow: true, bpl_household: true },
  }),
};
