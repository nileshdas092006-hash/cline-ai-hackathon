// Fixed bilingual labels used inside engine messages. Pure.
// Assamese strings are drafts and must be reviewed by a native speaker before the demo.
import type { DocType, FixWhere } from "./types";

export interface Bilingual {
  en: string;
  as: string;
}

export const DOC_LABELS: Record<DocType, Bilingual> = {
  aadhaar: { en: "Aadhaar card", as: "আধাৰ কাৰ্ড" },
  bank_passbook: { en: "bank passbook", as: "বেংক পাছবুক" },
  land_record: { en: "land record (jamabandi)", as: "মাটিৰ নথি (জমাবন্দী)" },
  ration_card: { en: "ration card", as: "ৰেচন কাৰ্ড" },
  death_certificate: { en: "husband's death certificate", as: "স্বামীৰ মৃত্যুৰ প্ৰমাণপত্ৰ" },
  bpl_proof: { en: "BPL proof", as: "বিপিএল (BPL) প্ৰমাণ" },
  voter_id: { en: "voter ID card", as: "ভোটাৰ পৰিচয়পত্ৰ" },
  age_proof: { en: "age proof", as: "বয়সৰ প্ৰমাণ" },
  address_proof: { en: "address proof", as: "ঠিকনাৰ প্ৰমাণ" },
  self_declaration: { en: "self-declaration", as: "স্ব-ঘোষণা পত্ৰ" },
  income_certificate: { en: "income certificate", as: "আয়ৰ প্ৰমাণপত্ৰ" },
  other: { en: "other document", as: "অন্য নথি" },
};

export const FIX_WHERE_LABELS: Record<FixWhere, Bilingual> = {
  bank: { en: "your bank branch", as: "আপোনাৰ বেংকৰ শাখা" },
  aadhaar_centre: { en: "an Aadhaar enrolment/update centre", as: "আধাৰ পঞ্জীয়ন/আপডেট কেন্দ্ৰ" },
  circle_office: { en: "the revenue circle office", as: "ৰাজহ চক্ৰ কাৰ্যালয়" },
  gram_panchayat: { en: "the Gram Panchayat office", as: "গাঁও পঞ্চায়ত কাৰ্যালয়" },
  block_office: { en: "the block development office", as: "উন্নয়ন খণ্ড কাৰ্যালয়" },
  csc: { en: "a Common Service Centre (CSC)", as: "সাধাৰণ সেৱা কেন্দ্ৰ (CSC)" },
  pm_kisan_portal: { en: "the PM-KISAN portal (pmkisan.gov.in)", as: "PM-KISAN প'ৰ্টেল (pmkisan.gov.in)" },
  supply_office: { en: "the food and civil supplies office", as: "খাদ্য আৰু অসামৰিক যোগান কাৰ্যালয়" },
  registrar: { en: "the birth and death registrar", as: "জন্ম-মৃত্যু পঞ্জীয়কৰ কাৰ্যালয়" },
  applicant: { en: "you (the applicant)", as: "আপুনি (আবেদনকাৰী)" },
  none: { en: "nothing to do", as: "একো কৰিব নালাগে" },
};

export const DISCLAIMER: Bilingual = {
  en: "We help you catch preventable mistakes. We do not guarantee approval; the department decides.",
  as: "আমি আপোনাক এৰাব পৰা ভুলবোৰ ধৰাত সহায় কৰোঁ। আমি অনুমোদনৰ নিশ্চয়তা নিদিওঁ; বিভাগেহে সিদ্ধান্ত লয়।",
};
