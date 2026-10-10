// Orunodoi 3.0, Assam (id `orunodoi-3`). docs/schemes.md §2. Pure data, validated by SchemeRule.
// Verified: valid ration card, ₹1,250/month, no income certificate. Everything else is PROVISIONAL
// (secondary sources / 2020 guideline): it can only ever lead to needs_verification.
import { SchemeRule, type DocType, type Question } from "../types";
import { SOURCES, provisional, verified } from "./sources";

const official = verified(SOURCES.orunodoiOfficial);
const secondary = (clause: string) => provisional(SOURCES.orunodoiSecondary, clause);

type Q = Omit<Question, "provenance" | "fixWhere">;
const pq = (q: Q, clause: string): Question => ({ ...q, fixWhere: "gram_panchayat", provenance: secondary(clause) });

const anyOf: Q[] = [
  { id: "widow", labelEn: "widow", labelAs: "বিধৱা", textEn: "Is the woman applicant a widow?", textAs: "মহিলা আবেদনকাৰী গৰাকী বিধৱা নেকি?" },
  {
    id: "person_with_disability",
    labelEn: "person with disability in the family",
    labelAs: "পৰিয়ালত দিব্যাংগ ব্যক্তি",
    textEn: "Is there a person with a disability in your family?",
    textAs: "আপোনাৰ পৰিয়ালত কোনো দিব্যাংগ ব্যক্তি আছে নেকি?",
  },
  {
    id: "aay_card",
    labelEn: "Antyodaya (AAY) card holder",
    labelAs: "অন্ত্যোদয় (AAY) কাৰ্ডধাৰী",
    textEn: "Does your family have an Antyodaya Anna Yojana (AAY) ration card?",
    textAs: "আপোনাৰ পৰিয়ালৰ অন্ত্যোদয় অন্ন যোজনা (AAY) ৰেচন কাৰ্ড আছে নেকি?",
  },
  {
    id: "income_below_2_lakh",
    labelEn: "household income under ₹2 lakh a year",
    labelAs: "বছৰি ₹২ লাখতকৈ কম পাৰিবাৰিক আয়",
    textEn: "Is your household income less than ₹2 lakh a year?",
    textAs: "আপোনাৰ পাৰিবাৰিক আয় বছৰি ₹২ লাখতকৈ কম নেকি?",
  },
];

const exclusions: Q[] = [
  {
    id: "elected_representative",
    labelEn: "elected representative in the family",
    labelAs: "পৰিয়ালত নিৰ্বাচিত জনপ্ৰতিনিধি",
    textEn: "Is anyone in your family a current or former elected representative (MLA, MP, panchayat, etc.)?",
    textAs: "আপোনাৰ পৰিয়ালৰ কোনোবা বৰ্তমান বা প্ৰাক্তন নিৰ্বাচিত জনপ্ৰতিনিধি (বিধায়ক, সাংসদ, পঞ্চায়ত আদি) নেকি?",
  },
  {
    id: "professional",
    labelEn: "doctor, engineer, lawyer or CA in the family",
    labelAs: "পৰিয়ালত চিকিৎসক, অভিযন্তা, উকীল বা CA",
    textEn: "Is anyone in your family a practising doctor, engineer, lawyer or chartered accountant?",
    textAs: "আপোনাৰ পৰিয়ালৰ কোনোবা কৰ্মৰত চিকিৎসক, অভিযন্তা, উকীল বা চাৰ্টাৰ্ড একাউণ্টেণ্ট নেকি?",
  },
  {
    id: "govt_staff_or_pensioner",
    labelEn: "government staff, teacher or pensioner in the family",
    labelAs: "পৰিয়ালত চৰকাৰী কৰ্মচাৰী, শিক্ষক বা পেঞ্চনভোগী",
    textEn: "Is anyone in your family a government employee, teacher or government pensioner?",
    textAs: "আপোনাৰ পৰিয়ালৰ কোনোবা চৰকাৰী কৰ্মচাৰী, শিক্ষক বা চৰকাৰী পেঞ্চনভোগী নেকি?",
  },
  {
    id: "contractor_or_trader",
    labelEn: "contractor or trader in the family",
    labelAs: "পৰিয়ালত ঠিকাদাৰ বা ব্যৱসায়ী",
    textEn: "Is anyone in your family a registered contractor or trader?",
    textAs: "আপোনাৰ পৰিয়ালৰ কোনোবা পঞ্জীভুক্ত ঠিকাদাৰ বা ব্যৱসায়ী নেকি?",
  },
  {
    id: "large_landholder",
    labelEn: "large landholding",
    labelAs: "বৃহৎ মাটিৰ গৰাকী",
    textEn: "Does your family own a large amount of land (more than the local limit)?",
    textAs: "আপোনাৰ পৰিয়ালৰ বহুত মাটি (স্থানীয় সীমাতকৈ বেছি) আছে নেকি?",
  },
  {
    id: "four_wheeler",
    labelEn: "owns a four-wheeler",
    labelAs: "চাৰিচকীয়া বাহন আছে",
    textEn: "Does anyone in your family own a four-wheeler (car, jeep, etc.)?",
    textAs: "আপোনাৰ পৰিয়ালৰ কোনোবাৰ চাৰিচকীয়া বাহন (গাড়ী, জীপ আদি) আছে নেকি?",
  },
  {
    id: "similar_state_scheme",
    labelEn: "already gets a similar state cash scheme",
    labelAs: "ইতিমধ্যে একে ধৰণৰ ৰাজ্যিক নগদ আঁচনি পায়",
    textEn: "Does your family already get money from a similar state cash-transfer scheme?",
    textAs: "আপোনাৰ পৰিয়ালে ইতিমধ্যে একে ধৰণৰ ৰাজ্যিক নগদ ধন হস্তান্তৰ আঁচনিৰ পৰা টকা পায় নেকি?",
  },
];

const SUPPORTING: DocType[] = ["aadhaar", "bank_passbook", "voter_id", "age_proof", "address_proof", "self_declaration"];

export const orunodoi3: SchemeRule = SchemeRule.parse({
  id: "orunodoi-3",
  version: "2.0.0",
  nameEn: "Orunodoi 3.0 (Assam)",
  nameAs: "অৰুণোদয় ৩.০ (অসম)",
  confirmAt: "gram_panchayat",
  benefit: {
    centralShare: 0,
    stateTopUp: 1250,
    period: "month",
    provenance: verified(SOURCES.orunodoiOfficial, "₹1,250 per month to families with valid ration cards"),
  },
  mandatoryDocs: [
    { docType: "ration_card", fixWhere: "supply_office", provenance: verified(SOURCES.orunodoiOfficial, "Valid ration card") },
  ],
  supportingDocs: SUPPORTING.map((docType) => ({
    docType,
    fixWhere: "gram_panchayat",
    provenance: secondary("Supporting documents commonly asked (not confirmed for 3.0)"),
  })),
  supportingDocsNoteEn: "Commonly asked; confirm the current list at the Gram Panchayat.",
  supportingDocsNoteAs: "সাধাৰণতে বিচৰা হয়; বৰ্তমানৰ তালিকাখন গাঁও পঞ্চায়তত নিশ্চিত কৰক।",
  nameReference: "ration_card",
  nameChecks: [
    { docType: "aadhaar", field: "name", fixWhere: "aadhaar_centre", provenance: official },
    { docType: "bank_passbook", field: "name", fixWhere: "bank", provenance: official },
  ],
  requirements: [
    pq(
      {
        id: "nfsa_enrolled",
        labelEn: "enrolled under NFSA",
        labelAs: "NFSAৰ অধীনত পঞ্জীভুক্ত",
        textEn: "Is your family enrolled under the National Food Security Act (NFSA)?",
        textAs: "আপোনাৰ পৰিয়াল ৰাষ্ট্ৰীয় খাদ্য সুৰক্ষা আইন (NFSA)ৰ অধীনত পঞ্জীভুক্ত নেকি?",
      },
      "NFSA enrolment precondition (myScheme; the official page says only 'valid ration card')",
    ),
  ],
  eligibilityAnyOf: anyOf.map((q) => pq(q, "Eligibility any-of list (2020 guideline; not confirmed for 3.0)")),
  exclusions: exclusions.map((q) => pq(q, "Exclusion list (2020 guideline; not confirmed for 3.0)")),
  externalChecks: [
    {
      id: "ration_card_valid",
      labelEn: "ration card is valid and active",
      labelAs: "ৰেচন কাৰ্ড বৈধ আৰু সক্ৰিয়",
      howEn: "Check at the fair price shop or the food and civil supplies office that the card is active.",
      howAs: "কাৰ্ডখন সক্ৰিয় নে নাই, ন্যায্য মূল্যৰ দোকান বা খাদ্য আৰু অসামৰিক যোগান কাৰ্যালয়ত চাওক।",
      fixWhere: "supply_office",
      provenance: official,
    },
  ],
  notes: [
    {
      id: "no_income_certificate",
      textEn: "No income certificate is required.",
      textAs: "আয়ৰ প্ৰমাণপত্ৰৰ প্ৰয়োজন নাই।",
      provenance: verified(SOURCES.orunodoiOfficial, "No income certificate required"),
    },
    {
      id: "selection_by_checklist",
      textEn: "Preliminary selection is based on an undertaking-cum-checklist (Annexure A).",
      textAs: "প্ৰাথমিক বাছনি অংগীকাৰ-তথা-পৰীক্ষা তালিকা (Annexure A)ৰ ভিত্তিত হয়।",
      provenance: official,
    },
  ],
});

