// Widow Pension, IGNWPS under NSAP (id `nsap-widow`). docs/schemes.md §3. Pure data, validated by SchemeRule.
import { SchemeRule } from "../types";
import { SOURCES, provisional, verified } from "./sources";

// The source has no official document list: every document is "commonly required; confirm locally".
const docs = provisional(SOURCES.ignwps, "Documents commonly required (no official list); confirm locally");

export const nsapWidow: SchemeRule = SchemeRule.parse({
  id: "nsap-widow",
  version: "2.0.0",
  nameEn: "Widow Pension (IGNWPS, NSAP)",
  nameAs: "বিধৱা পেঞ্চন (IGNWPS, NSAP)",
  confirmAt: "block_office",
  benefit: {
    centralShare: 300,
    stateTopUp: null,
    period: "month",
    provenance: verified(SOURCES.ignwps, "Central assistance ₹300 per month for widows aged 40–79"),
  },
  mandatoryDocs: [
    { docType: "aadhaar", fixWhere: "aadhaar_centre", provenance: docs },
    { docType: "death_certificate", fixWhere: "registrar", provenance: docs },
    { docType: "bank_passbook", fixWhere: "bank", provenance: docs },
    { docType: "bpl_proof", fixWhere: "block_office", provenance: docs },
  ],
  nameReference: "aadhaar",
  nameChecks: [{ docType: "bank_passbook", field: "name", fixWhere: "bank", provenance: docs }],
  ageRange: {
    min: 40,
    max: 79,
    dobFrom: "aadhaar",
    aboveMaxHintEn: "At 80 or older, ask about the Old Age Pension (IGNOAPS) instead.",
    aboveMaxHintAs: "৮০ বছৰ বা তাতকৈ বেছি হ'লে, ইয়াৰ সলনি বৃদ্ধ পেঞ্চন (IGNOAPS)ৰ বিষয়ে সোধক।",
    provenance: verified(SOURCES.ignwps, "Eligible age 40–79 years"),
  },
  requirements: [
    {
      id: "is_widow",
      labelEn: "widow",
      labelAs: "বিধৱা",
      textEn: "Are you a widow (your husband has died)?",
      textAs: "আপুনি বিধৱা নেকি (আপোনাৰ স্বামীৰ মৃত্যু হৈছে)?",
      fixWhere: "block_office",
      provenance: verified(SOURCES.ignwps, "Applicant must be a widow"),
    },
    {
      id: "bpl_household",
      labelEn: "household is below the poverty line (BPL)",
      labelAs: "পৰিয়াল দৰিদ্ৰ সীমাৰেখাৰ তলত (BPL)",
      textEn: "Is your household below the poverty line (BPL) as per Government of India criteria?",
      textAs: "ভাৰত চৰকাৰৰ মাপকাঠী অনুসৰি আপোনাৰ পৰিয়াল দৰিদ্ৰ সীমাৰেখাৰ তলত (BPL) নেকি?",
      fixWhere: "block_office",
      provenance: verified(SOURCES.ignwps, "Household below the poverty line as per GoI criteria"),
    },
  ],
  notes: [
    {
      id: "state_top_up_unconfirmed",
      textEn: "₹300 a month from the central government, plus any state top-up; confirm the state amount locally.",
      textAs: "কেন্দ্ৰীয় চৰকাৰৰ পৰা মাহে ₹৩০০, লগতে ৰাজ্যৰ যিকোনো অতিৰিক্ত ধন; ৰাজ্যৰ ধনৰ পৰিমাণ স্থানীয়ভাৱে নিশ্চিত কৰক।",
      provenance: provisional(SOURCES.ignwps, "Assam state top-up not confirmed"),
    },
  ],
});
