// Known rejection reasons → fix steps (English + Assamese). Pure.
// Used by the rejection decoder (T4): the AI only maps notice text to a code; these steps are fixed.
import { z } from "zod";
import type { FixWhere } from "./types";

export const REJECTION_CODES = [
  "NAME_MISMATCH_AADHAAR",
  "AADHAAR_NOT_SEEDED_BANK",
  "INVALID_ACCOUNT_IFSC",
  "ACCOUNT_INACTIVE",
  "LAND_NOT_VERIFIED",
  "EKYC_PENDING",
  "PENDING_STATE_ACTION",
  "UNKNOWN",
] as const;

export const RejectionCode = z.enum(REJECTION_CODES);
export type RejectionCode = z.infer<typeof RejectionCode>;

export interface FixSteps {
  code: RejectionCode;
  titleEn: string;
  titleAs: string;
  stepsEn: string[];
  stepsAs: string[];
  fixWhere: FixWhere;
}

const FIXES: Record<RejectionCode, Omit<FixSteps, "code">> = {
  NAME_MISMATCH_AADHAAR: {
    titleEn: "Your name does not match your Aadhaar",
    titleAs: "আপোনাৰ নাম আধাৰৰ সৈতে মিল নাই",
    stepsEn: [
      "Compare the name on your Aadhaar, bank passbook and application letter by letter.",
      "Ask your bank branch to correct the account name to match Aadhaar exactly (or update Aadhaar at an Aadhaar centre if Aadhaar is wrong).",
      "Then ask for the name to be corrected in the scheme record (CSC or scheme office).",
    ],
    stepsAs: [
      "আধাৰ, বেংক পাছবুক আৰু আবেদনত থকা নামটো আখৰে আখৰে মিলাই চাওক।",
      "আধাৰৰ সৈতে হুবহু মিলাবলৈ বেংকৰ শাখাত একাউণ্টৰ নাম শুধৰাবলৈ কওক (আধাৰ ভুল হ'লে আধাৰ কেন্দ্ৰত আধাৰ আপডেট কৰক)।",
      "তাৰ পিছত আঁচনিৰ নথিত নামটো শুধৰাবলৈ কওক (CSC বা আঁচনিৰ কাৰ্যালয়ত)।",
    ],
    fixWhere: "bank",
  },
  AADHAAR_NOT_SEEDED_BANK: {
    titleEn: "Aadhaar is not linked (seeded) to your bank account",
    titleAs: "আপোনাৰ বেংক একাউণ্টত আধাৰ সংযোগ (ছিডিং) হোৱা নাই",
    stepsEn: [
      "Go to your bank branch with your Aadhaar card and passbook.",
      "Ask them to seed Aadhaar to the account for DBT (NPCI mapping) and give you an acknowledgement.",
      "Check the status after a few days at the bank or on the scheme portal.",
    ],
    stepsAs: [
      "আধাৰ কাৰ্ড আৰু পাছবুক লৈ আপোনাৰ বেংকৰ শাখালৈ যাওক।",
      "DBTৰ বাবে একাউণ্টত আধাৰ সংযোগ (NPCI মেপিং) কৰি দিবলৈ কওক আৰু প্ৰাপ্তি-পত্ৰ লওক।",
      "কেইদিনমানৰ পিছত বেংকত বা আঁচনিৰ প'ৰ্টেলত স্থিতি চাওক।",
    ],
    fixWhere: "bank",
  },
  INVALID_ACCOUNT_IFSC: {
    titleEn: "The bank account number or IFSC code is wrong",
    titleAs: "বেংক একাউণ্ট নম্বৰ বা IFSC ক'ড ভুল",
    stepsEn: [
      "Copy the account number and IFSC exactly from your passbook's first page.",
      "If the branch was merged or renamed, ask the bank for the current IFSC.",
      "Ask the CSC or scheme office to correct the bank details in your record.",
    ],
    stepsAs: [
      "পাছবুকৰ প্ৰথম পৃষ্ঠাৰ পৰা একাউণ্ট নম্বৰ আৰু IFSC হুবহু লিখি লওক।",
      "শাখাটো একত্ৰিত বা নাম সলনি হৈছে যদি, বৰ্তমানৰ IFSC বেংকৰ পৰা জানি লওক।",
      "আপোনাৰ নথিত বেংকৰ তথ্য শুধৰাবলৈ CSC বা আঁচনিৰ কাৰ্যালয়ত কওক।",
    ],
    fixWhere: "bank",
  },
  ACCOUNT_INACTIVE: {
    titleEn: "Your bank account is inactive or closed",
    titleAs: "আপোনাৰ বেংক একাউণ্ট নিষ্ক্ৰিয় বা বন্ধ",
    stepsEn: [
      "Go to your bank branch and ask them to reactivate the account (usually with KYC documents).",
      "Make a small deposit or withdrawal so the account shows recent activity.",
    ],
    stepsAs: [
      "বেংকৰ শাখালৈ গৈ একাউণ্টটো পুনৰ সক্ৰিয় কৰিবলৈ কওক (সাধাৰণতে KYC নথিৰে)।",
      "একাউণ্টত শেহতীয়া লেনদেন দেখুৱাবলৈ সৰু জমা বা উলিওৱা এটা কৰক।",
    ],
    fixWhere: "bank",
  },
  LAND_NOT_VERIFIED: {
    titleEn: "Your land record is not verified yet",
    titleAs: "আপোনাৰ মাটিৰ নথি এতিয়াও সত্যাপিত হোৱা নাই",
    stepsEn: [
      "Take your land record (jamabandi) and Aadhaar to the revenue circle office.",
      "Ask them to verify your land details for the scheme (land seeding).",
      "Make sure the owner name on the land record matches your Aadhaar.",
    ],
    stepsAs: [
      "মাটিৰ নথি (জমাবন্দী) আৰু আধাৰ লৈ ৰাজহ চক্ৰ কাৰ্যালয়লৈ যাওক।",
      "আঁচনিৰ বাবে আপোনাৰ মাটিৰ তথ্য সত্যাপন (লেণ্ড ছিডিং) কৰিবলৈ কওক।",
      "মাটিৰ নথিত থকা গৰাকীৰ নাম আধাৰৰ সৈতে মিল আছে নে নাই নিশ্চিত কৰক।",
    ],
    fixWhere: "circle_office",
  },
  EKYC_PENDING: {
    titleEn: "eKYC is not done",
    titleAs: "eKYC কৰা হোৱা নাই",
    stepsEn: [
      "Do OTP-based eKYC on pmkisan.gov.in with the mobile number linked to Aadhaar.",
      "If OTP does not work, do biometric eKYC at a Common Service Centre (CSC).",
    ],
    stepsAs: [
      "আধাৰৰ সৈতে সংযুক্ত মোবাইল নম্বৰেৰে pmkisan.gov.in ত OTP-ভিত্তিক eKYC কৰক।",
      "OTP কাম নকৰিলে সাধাৰণ সেৱা কেন্দ্ৰ (CSC)ত বায়'মেট্ৰিক eKYC কৰক।",
    ],
    fixWhere: "pm_kisan_portal",
  },
  PENDING_STATE_ACTION: {
    titleEn: "Waiting for action by the state government",
    titleAs: "ৰাজ্য চৰকাৰৰ কাৰ্যৰ বাবে অপেক্ষাৰত",
    stepsEn: [
      "Nothing is wrong with your papers yet; the state still has to approve or forward your application.",
      "If it stays pending for a long time, ask at the block or agriculture office with your registration number.",
    ],
    stepsAs: [
      "আপোনাৰ কাগজত এতিয়ালৈকে একো ভুল নাই; ৰাজ্যই আপোনাৰ আবেদন অনুমোদন বা আগবঢ়াবলৈ বাকী আছে।",
      "বহুদিন ধৰি বাকী থাকিলে পঞ্জীয়ন নম্বৰ লৈ উন্নয়ন খণ্ড বা কৃষি কাৰ্যালয়ত সোধক।",
    ],
    fixWhere: "block_office",
  },
  UNKNOWN: {
    titleEn: "We could not recognise this reason",
    titleAs: "আমি এই কাৰণটো চিনিব নোৱাৰিলোঁ",
    stepsEn: [
      "Take the rejection notice to the office that issued it and ask what exactly needs to be fixed.",
      "Ask for the answer in writing if possible.",
    ],
    stepsAs: [
      "নাকচৰ জাননীখন যি কাৰ্যালয়ে দিছে তালৈ লৈ গৈ ঠিক কি শুধৰাব লাগিব সোধক।",
      "সম্ভৱ হ'লে উত্তৰটো লিখিতভাৱে বিচাৰক।",
    ],
    fixWhere: "block_office",
  },
};

export function fixStepsFor(code: RejectionCode): FixSteps {
  return { code, ...FIXES[code] };
}
