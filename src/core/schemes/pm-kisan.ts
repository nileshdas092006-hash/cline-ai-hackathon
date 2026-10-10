// PM-KISAN (id `pm-kisan`): flagship demo. docs/schemes.md §1. Pure data, validated by SchemeRule.
// NOTE: there is deliberately NO landholding-size rule (the earlier limit was removed in 2019).
import { SchemeRule, type SchemeRuleInput } from "../types";
import { SOURCES, verified } from "./sources";

const core = verified(SOURCES.pmKisanPortal);
const exclusion = (clause: string) => verified(SOURCES.pmKisanGuide, `Exclusion criteria: ${clause}`);

const exclusions: SchemeRuleInput["exclusions"] = [
  {
    id: "holds_constitutional_post",
    labelEn: "holds or held a constitutional post",
    labelAs: "সাংবিধানিক পদত আছে বা আছিল",
    textEn: "Does anyone in your family hold, or did they hold, a constitutional post?",
    textAs: "আপোনাৰ পৰিয়ালৰ কোনোবাই সাংবিধানিক পদত আছে নেকি বা আছিল নেকি?",
    provenance: exclusion("former and present holders of constitutional posts"),
  },
  {
    id: "govt_employee",
    labelEn: "serving or retired government employee",
    labelAs: "কৰ্মৰত বা অৱসৰপ্ৰাপ্ত চৰকাৰী কৰ্মচাৰী",
    textEn: "Is anyone in your family a serving or retired government employee (not MTS, Class IV or Group D)?",
    textAs: "আপোনাৰ পৰিয়ালৰ কোনোবা কৰ্মৰত বা অৱসৰপ্ৰাপ্ত চৰকাৰী কৰ্মচাৰী নেকি (MTS, চতুৰ্থ শ্ৰেণী বা গ্ৰুপ D বাদে)?",
    provenance: exclusion("serving or retired officers and employees of government (except MTS/Class IV/Group D)"),
  },
  {
    id: "income_tax_payer",
    labelEn: "paid income tax in the last assessment year",
    labelAs: "যোৱা মূল্যায়ন বৰ্ষত আয়কৰ দিছে",
    textEn: "Did anyone in your family pay income tax in the last assessment year?",
    textAs: "যোৱা মূল্যায়ন বৰ্ষত আপোনাৰ পৰিয়ালৰ কোনোবাই আয়কৰ দিছিল নেকি?",
    provenance: exclusion("persons who paid income tax in the last assessment year"),
  },
  {
    id: "practising_professional",
    labelEn: "practising doctor, engineer, lawyer, CA or architect",
    labelAs: "কৰ্মৰত চিকিৎসক, অভিযন্তা, উকীল, CA বা স্থপতি",
    textEn: "Is anyone in your family a practising doctor, engineer, lawyer, chartered accountant or architect?",
    textAs: "আপোনাৰ পৰিয়ালৰ কোনোবা কৰ্মৰত চিকিৎসক, অভিযন্তা, উকীল, চাৰ্টাৰ্ড একাউণ্টেণ্ট বা স্থপতি নেকি?",
    provenance: exclusion("professionals registered with professional bodies and practising"),
  },
  {
    id: "pension_10k_plus",
    labelEn: "pension of ₹10,000 or more a month",
    labelAs: "মাহে ₹১০,০০০ বা তাতকৈ বেছি পেঞ্চন",
    textEn: "Does anyone in your family get a pension of ₹10,000 or more a month (not MTS, Class IV or Group D)?",
    textAs: "আপোনাৰ পৰিয়ালৰ কোনোবাই মাহে ₹১০,০০০ বা তাতকৈ বেছি পেঞ্চন পায় নেকি (MTS, চতুৰ্থ শ্ৰেণী বা গ্ৰুপ D বাদে)?",
    provenance: exclusion("retired pensioners with a monthly pension of ₹10,000 or more"),
  },
];

const externalChecks: SchemeRuleInput["externalChecks"] = [
  {
    id: "aadhaar_bank_seeding",
    labelEn: "Aadhaar linked (seeded) to your bank account",
    labelAs: "বেংক একাউণ্টত আধাৰ সংযোগ (ছিডিং)",
    howEn: "Ask at your bank branch whether Aadhaar is seeded to this account for DBT.",
    howAs: "এই একাউণ্টত DBTৰ বাবে আধাৰ সংযোগ হৈছে নে নাই, বেংকৰ শাখাত সোধক।",
    fixWhere: "bank",
    provenance: core,
  },
  {
    id: "account_active",
    labelEn: "bank account is active",
    labelAs: "বেংক একাউণ্ট সক্ৰিয়",
    howEn: "Ask your bank branch, or check that a recent transaction went through.",
    howAs: "বেংকৰ শাখাত সোধক, বা শেহতীয়া লেনদেন এটা হৈছে নে নাই চাওক।",
    fixWhere: "bank",
    provenance: core,
  },
  {
    id: "ekyc",
    labelEn: "eKYC done",
    labelAs: "eKYC সম্পূৰ্ণ",
    howEn: "Do OTP eKYC on pmkisan.gov.in, or biometric eKYC at a CSC.",
    howAs: "pmkisan.gov.in ত OTP eKYC কৰক, বা CSC ত বায়'মেট্ৰিক eKYC কৰক।",
    fixWhere: "pm_kisan_portal",
    provenance: core,
  },
  {
    id: "land_verified",
    labelEn: "land verified by the state",
    labelAs: "ৰাজ্যই মাটি সত্যাপন কৰিছে",
    howEn: "Ask at the revenue circle office whether your land details are verified for PM-KISAN.",
    howAs: "PM-KISANৰ বাবে আপোনাৰ মাটিৰ তথ্য সত্যাপিত হৈছে নে নাই, ৰাজহ চক্ৰ কাৰ্যালয়ত সোধক।",
    fixWhere: "circle_office",
    provenance: core,
  },
];

export const pmKisan: SchemeRule = SchemeRule.parse({
  id: "pm-kisan",
  version: "2.0.0",
  nameEn: "PM-KISAN (Pradhan Mantri Kisan Samman Nidhi)",
  nameAs: "পি এম কিষাণ (প্ৰধান মন্ত্ৰী কিষাণ সন্মান নিধি)",
  confirmAt: "csc",
  benefit: {
    centralShare: 6000,
    stateTopUp: 0,
    period: "year",
    instalments: 3,
    provenance: verified(SOURCES.pmKisanPortal, "₹6,000 per year in three instalments of ₹2,000 by DBT"),
  },
  mandatoryDocs: [
    { docType: "aadhaar", fixWhere: "aadhaar_centre", provenance: core },
    { docType: "bank_passbook", fixWhere: "bank", provenance: core },
    { docType: "land_record", fixWhere: "circle_office", provenance: core },
  ],
  nameReference: "aadhaar",
  nameChecks: [
    { docType: "bank_passbook", field: "name", fixWhere: "bank", provenance: core },
    {
      docType: "land_record",
      field: "ownerNames",
      fixWhere: "circle_office",
      provenance: verified(SOURCES.pmKisanGuide, "Land owned by the farmer family as per state land records"),
      familyOwnerQuestion: {
        id: "land_in_family_member_name",
        labelEn: "land in a family member's name",
        labelAs: "পৰিয়ালৰ সদস্যৰ নামত মাটি",
        textEn: "Is the land recorded in the name of your husband/wife or minor child (not yours)?",
        textAs: "মাটিখন আপোনাৰ নামত নহয়, আপোনাৰ স্বামী/পত্নী বা নাবালক সন্তানৰ নামত পঞ্জীভুক্ত নেকি?",
        fixWhere: "circle_office",
        provenance: verified(SOURCES.pmKisanGuide, "Farmer family = husband, wife and minor children"),
      },
    },
  ],
  fieldChecks: [
    {
      id: "ifsc",
      docType: "bank_passbook",
      field: "ifsc",
      pattern: "^[A-Z]{4}0[A-Z0-9]{6}$",
      labelEn: "IFSC code",
      labelAs: "IFSC ক'ড",
      hintEn: "An IFSC has 11 characters: 4 letters, then 0, then 6 letters or digits (e.g. SBIN0001234).",
      hintAs: "IFSC ত ১১টা আখৰ থাকে: ৪টা আখৰ, তাৰ পিছত 0, তাৰ পিছত ৬টা আখৰ বা সংখ্যা (যেনে SBIN0001234)।",
      fixWhere: "bank",
      provenance: core,
    },
    {
      id: "account_no",
      docType: "bank_passbook",
      field: "accountNo",
      pattern: "^\\d{9,18}$",
      labelEn: "bank account number",
      labelAs: "বেংক একাউণ্ট নম্বৰ",
      hintEn: "An account number has 9 to 18 digits.",
      hintAs: "একাউণ্ট নম্বৰত ৯ৰ পৰা ১৮টা সংখ্যা থাকে।",
      fixWhere: "bank",
      provenance: core,
    },
  ],
  exclusions,
  externalChecks,
  notes: [
    {
      id: "no_holding_size_limit",
      textEn: "Any landholding farmer family can apply, whatever the size of its land.",
      textAs: "যিকোনো মাটিৰ গৰাকী কৃষক পৰিয়ালে আবেদন কৰিব পাৰে, মাটি যিমানেই নহওক।",
      provenance: verified(SOURCES.pmKisanGuide, "Scheme extended to all landholding farmer families (2019)"),
    },
  ],
});

