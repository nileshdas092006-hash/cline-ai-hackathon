// Rejection decoder: the AI only proposes ONE known code + a confidence; this pure module decides
// what the citizen sees. Fix steps always come from rejectionCodes.ts, never from model text.
import { z } from "zod";
import type { Bilingual } from "./labels";
import { RejectionCode, fixStepsFor, type FixSteps } from "./rejectionCodes";

/** Below this, or for UNKNOWN, the answer is "needs verification". */
export const DECODE_CONFIDENCE_THRESHOLD = 0.7;
/** Longest message the decoder accepts (a status SMS or a notice paragraph). */
export const MAX_DECODE_CHARS = 2000;

/** What the model must return (validated in ai.ts). */
export const RawClassification = z.object({
  code: RejectionCode,
  confidence: z.number().min(0).max(1),
});
export type RawClassification = z.infer<typeof RawClassification>;

export interface DecodeResult {
  status: "matched" | "needs_verification";
  /** The code whose steps are shown: UNKNOWN unless matched. */
  code: RejectionCode;
  /** The model's confidence, or null when no AI answer was available. */
  confidence: number | null;
  fix: FixSteps;
  /** A low-confidence guess, shown only as "possibly"; never as the answer. */
  possible: FixSteps | null;
  /** What to ask at the office (empty when matched). */
  ask: Bilingual[];
}

/** Assamese strings are drafts awaiting native-speaker review. */
export const ASK_AT_OFFICE: Bilingual[] = [
  {
    en: "What exactly is the reason for the rejection or hold? Please show me where it is written.",
    as: "নাকচ বা ৰখাৰ সঠিক কাৰণ কি? ক'ত লিখা আছে অনুগ্ৰহ কৰি দেখুৱাওক।",
  },
  {
    en: "Which document or detail must I correct, and at which office or bank?",
    as: "মই কোনখন নথি বা কোনটো তথ্য শুধৰাব লাগিব, আৰু কোন কাৰ্যালয় বা বেংকত?",
  },
  {
    en: "After I fix it, how do I re-apply or ask for a review, and by when?",
    as: "শুধৰোৱাৰ পিছত মই কেনেকৈ পুনৰ আবেদন বা পুনৰীক্ষণৰ বাবে অনুৰোধ কৰিম, আৰু কেতিয়ালৈকে?",
  },
  {
    en: "Can I get the answer in writing, with my application or registration number?",
    as: "মোৰ আবেদন বা পঞ্জীয়ন নম্বৰৰ সৈতে উত্তৰটো লিখিতভাৱে পাব পাৰোঁনে?",
  },
];

/** Turns the (already zod-validated) model answer into what the citizen sees. null = no AI answer. */
export function decodeResult(ai: RawClassification | null): DecodeResult {
  const confident =
    ai !== null && ai.code !== "UNKNOWN" && ai.confidence >= DECODE_CONFIDENCE_THRESHOLD && ai.confidence <= 1;
  if (confident) {
    return { status: "matched", code: ai.code, confidence: ai.confidence, fix: fixStepsFor(ai.code), possible: null, ask: [] };
  }
  return {
    status: "needs_verification",
    code: "UNKNOWN",
    confidence: ai?.confidence ?? null,
    fix: fixStepsFor("UNKNOWN"),
    possible: ai && ai.code !== "UNKNOWN" ? fixStepsFor(ai.code) : null,
    ask: ASK_AT_OFFICE,
  };
}

/**
 * Minimum personal data to the model: any digit run (spaces/dashes allowed inside) with 12 digits
 * is treated as an Aadhaar number and masked to its last 4; any other run of 9+ digits (bank
 * account, phone) becomes "[number]". Short numbers and dates stay (they help classification).
 */
export function redactForModel(text: string): string {
  return text.replace(/\d(?:[\s-]*\d)+/g, (run) => {
    const digits = run.replace(/\D/g, "");
    if (digits.length === 12) return `XXXX XXXX ${digits.slice(-4)}`;
    if (digits.length >= 9) return "[number]";
    return run;
  });
}
