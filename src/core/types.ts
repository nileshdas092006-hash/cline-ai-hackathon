// Types + zod schemas for the rule engine (rule packs v2, docs/schemes.md).
// Pure module: no UI, network, database or process.env imports.
import { z } from "zod";
import { isIsoDate } from "./dates";

export const IsoDate = z.string().refine(isIsoDate, { message: "expected a real date as YYYY-MM-DD" });

const SNAKE_ID = /^[a-z][a-z0-9_]*$/;
const SCHEME_ID = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const SEMVER = /^\d+\.\d+\.\d+$/;

// ---------- provenance ----------
export const RuleStatus = z.enum(["verified", "provisional"]);
export type RuleStatus = z.infer<typeof RuleStatus>;

export const RuleProvenance = z
  .object({
    sourceUrl: z.url().nullable(),
    sourceTitle: z.string().min(1),
    clause: z.string().min(1).nullable().optional(),
    effectiveDate: IsoDate.nullable().optional(),
    verifiedOn: IsoDate,
    version: z.string().regex(SEMVER),
    status: RuleStatus,
  })
  // A rule can only be "verified" if we can point to its source.
  .refine((p) => p.status === "provisional" || p.sourceUrl !== null, {
    message: "a verified rule needs a sourceUrl",
    path: ["sourceUrl"],
  });
export type RuleProvenance = z.infer<typeof RuleProvenance>;

// ---------- vocabulary ----------
export const DocType = z.enum([
  "aadhaar",
  "bank_passbook",
  "land_record",
  "ration_card",
  "death_certificate",
  "bpl_proof",
  "voter_id",
  "age_proof",
  "address_proof",
  "self_declaration",
  "income_certificate",
  "other",
]);
export type DocType = z.infer<typeof DocType>;

/** Where the citizen goes to fix or confirm something. */
export const FixWhere = z.enum([
  "bank",
  "aadhaar_centre",
  "circle_office",
  "gram_panchayat",
  "block_office",
  "csc",
  "pm_kisan_portal",
  "supply_office",
  "registrar",
  "applicant",
  "none",
]);
export type FixWhere = z.infer<typeof FixWhere>;

export const FieldName = z.enum([
  "name",
  "dob",
  "aadhaarLast4",
  "accountNo",
  "ifsc",
  "ownerNames",
  "husbandName",
  "landAreaHectares",
]);
export type FieldName = z.infer<typeof FieldName>;

// ---------- extracted documents (from the AI reader or manual entry) ----------
export const ExtractedDoc = z.object({
  docType: DocType,
  fields: z
    .object({
      name: z.string().optional(),
      dob: z.string().optional(),
      /** Only the last 4 digits of Aadhaar are ever kept. */
      aadhaarLast4: z.string().regex(/^\d{4}$/).optional(),
      accountNo: z.string().optional(),
      ifsc: z.string().optional(),
      ownerNames: z.array(z.string()).optional(),
      husbandName: z.string().optional(),
      landAreaHectares: z.number().nonnegative().optional(),
    })
    .strict(),
  /** Per-field confidence 0–1. A missing entry means "entered or confirmed by the user". */
  confidence: z.partialRecord(FieldName, z.number().min(0).max(1)),
});
export type ExtractedDoc = z.infer<typeof ExtractedDoc>;

/** Yes/no answers keyed by question id. Missing key = not answered. */
export const Answers = z.record(z.string(), z.boolean());
export type Answers = z.infer<typeof Answers>;

// ---------- scheme rule pack: building blocks ----------
export const Question = z.object({
  id: z.string().regex(SNAKE_ID),
  /** Short label used inside messages, e.g. "income tax payer". */
  labelEn: z.string().min(1),
  labelAs: z.string().min(1),
  textEn: z.string().min(1),
  textAs: z.string().min(1),
  /** Where to confirm this (defaults to the scheme's confirmAt). */
  fixWhere: FixWhere.optional(),
  provenance: RuleProvenance,
});
export type Question = z.infer<typeof Question>;

export const DocRequirement = z.object({
  docType: DocType,
  fixWhere: FixWhere,
  provenance: RuleProvenance,
});
export type DocRequirement = z.infer<typeof DocRequirement>;

export const NameCheckRule = z.object({
  docType: DocType,
  field: z.enum(["name", "ownerNames"]),
  fixWhere: FixWhere,
  provenance: RuleProvenance,
  /** If answered yes, an owner-name mismatch becomes "confirm" instead of "fix" (land owned by a family member). */
  familyOwnerQuestion: Question.optional(),
});
export type NameCheckRule = z.infer<typeof NameCheckRule>;

export const FieldCheckRule = z
  .object({
    id: z.string().regex(SNAKE_ID),
    docType: DocType,
    field: z.enum(["accountNo", "ifsc"]),
    /** Regex the value must match after removing spaces/hyphens and uppercasing. */
    pattern: z.string().min(1),
    labelEn: z.string().min(1),
    labelAs: z.string().min(1),
    hintEn: z.string().min(1),
    hintAs: z.string().min(1),
    fixWhere: FixWhere,
    provenance: RuleProvenance,
  })
  .refine(
    (f) => {
      try {
        new RegExp(f.pattern);
        return true;
      } catch {
        return false;
      }
    },
    { message: "pattern must be a valid regular expression", path: ["pattern"] },
  );
export type FieldCheckRule = z.infer<typeof FieldCheckRule>;

export const ExternalCheckRule = z.object({
  id: z.string().regex(SNAKE_ID),
  labelEn: z.string().min(1),
  labelAs: z.string().min(1),
  howEn: z.string().min(1),
  howAs: z.string().min(1),
  fixWhere: FixWhere,
  provenance: RuleProvenance,
});
export type ExternalCheckRule = z.infer<typeof ExternalCheckRule>;

export const AgeRange = z
  .object({
    min: z.int().nonnegative(),
    /** Omitted = no upper age limit (e.g. the Old Age Pension, 60+). */
    max: z.int().nonnegative().optional(),
    dobFrom: DocType,
    aboveMaxHintEn: z.string().optional(),
    aboveMaxHintAs: z.string().optional(),
    provenance: RuleProvenance,
  })
  .refine((a) => a.max === undefined || a.min <= a.max, { message: "min must be ≤ max" });
export type AgeRange = z.infer<typeof AgeRange>;

export const BenefitOverride = z
  .object({
    from: IsoDate,
    to: IsoDate,
    centralShare: z.number().nonnegative().optional(),
    stateTopUp: z.number().nonnegative().nullable().optional(),
    noteEn: z.string().min(1),
    noteAs: z.string().min(1),
    provenance: RuleProvenance,
  })
  .refine((o) => o.from <= o.to, { message: "override 'to' must not be before 'from'", path: ["to"] });
export type BenefitOverride = z.infer<typeof BenefitOverride>;

export const Benefit = z.object({
  centralShare: z.number().nonnegative(),
  /** null = unconfirmed; never show a total then. */
  stateTopUp: z.number().nonnegative().nullable(),
  period: z.enum(["month", "year"]),
  instalments: z.int().positive().optional(),
  effectiveDate: IsoDate.nullable().optional(),
  provenance: RuleProvenance,
  /** Time-bounded changes (e.g. a one-time payment for one month). Later entries win. */
  overrides: z.array(BenefitOverride).default([]),
});
export type Benefit = z.infer<typeof Benefit>;

export const SchemeNote = z.object({
  id: z.string().regex(SNAKE_ID),
  textEn: z.string().min(1),
  textAs: z.string().min(1),
  provenance: RuleProvenance,
});
export type SchemeNote = z.infer<typeof SchemeNote>;

// ---------- scheme rule pack ----------
export const SchemeRule = z.object({
  id: z.string().regex(SCHEME_ID),
  version: z.string().regex(SEMVER),
  nameEn: z.string().min(1),
  nameAs: z.string().min(1),
  /** Default place to confirm provisional rules. */
  confirmAt: FixWhere,
  benefit: Benefit,
  mandatoryDocs: z.array(DocRequirement),
  supportingDocs: z.array(DocRequirement).default([]),
  supportingDocsNoteEn: z.string().nullable().default(null),
  supportingDocsNoteAs: z.string().nullable().default(null),
  /** The document every other name is compared with. */
  nameReference: DocType,
  nameChecks: z.array(NameCheckRule).default([]),
  fieldChecks: z.array(FieldCheckRule).default([]),
  ageRange: AgeRange.optional(),
  /** Every one must be "yes". */
  requirements: z.array(Question).default([]),
  /** At least one must be "yes" (skipped when empty). */
  eligibilityAnyOf: z.array(Question).default([]),
  /** Any "yes" excludes (verified) or needs verification (provisional). */
  exclusions: z.array(Question).default([]),
  /** Facts a photo cannot prove: always needs_verification. */
  externalChecks: z.array(ExternalCheckRule).default([]),
  notes: z.array(SchemeNote).default([]),
});
export type SchemeRule = z.infer<typeof SchemeRule>;
export type SchemeRuleInput = z.input<typeof SchemeRule>;

// ---------- results ----------
export const NameMatchLevel = z.enum(["same", "possible_match", "initials_only", "mismatch"]);
export type NameMatchLevel = z.infer<typeof NameMatchLevel>;
export const NameMatchResult = z.object({ level: NameMatchLevel, score: z.number().min(0).max(1) });
export type NameMatchResult = z.infer<typeof NameMatchResult>;

export const CheckResult = z.enum(["ok", "action_required", "needs_verification", "not_applicable"]);
export type CheckResult = z.infer<typeof CheckResult>;

export const CheckKind = z.enum(["document", "name", "field", "eligibility", "external"]);
export type CheckKind = z.infer<typeof CheckKind>;

export const Check = z.object({
  id: z.string().min(1),
  kind: CheckKind,
  result: CheckResult,
  messageEn: z.string().min(1),
  messageAs: z.string().min(1),
  fixWhere: FixWhere,
  provenance: RuleProvenance,
  docType: DocType.optional(),
  match: NameMatchResult.optional(),
});
export type Check = z.infer<typeof Check>;

export const Eligibility = z.enum(["likely_eligible", "not_eligible", "needs_verification"]);
export type Eligibility = z.infer<typeof Eligibility>;
export const Readiness = z.enum(["ready_for_review", "action_required", "needs_verification"]);
export type Readiness = z.infer<typeof Readiness>;

export const BenefitOn = z.object({
  centralShare: z.number().nonnegative(),
  stateTopUp: z.number().nonnegative().nullable(),
  /** null when the state top-up is unconfirmed. */
  total: z.number().nonnegative().nullable(),
  period: z.enum(["month", "year"]),
  instalments: z.int().positive().optional(),
  isOverride: z.boolean(),
  noteEn: z.string().optional(),
  noteAs: z.string().optional(),
  provenance: RuleProvenance,
});
export type BenefitOn = z.infer<typeof BenefitOn>;

export const SupportingDocStatus = z.object({
  docType: DocType,
  labelEn: z.string(),
  labelAs: z.string(),
  present: z.boolean(),
  provenance: RuleProvenance,
});
export type SupportingDocStatus = z.infer<typeof SupportingDocStatus>;

export const Report = z.object({
  schemeId: z.string(),
  schemeVersion: z.string(),
  asOfDate: IsoDate,
  eligibility: Eligibility,
  readiness: Readiness,
  checks: z.array(Check),
  benefit: BenefitOn,
  supportingDocs: z.array(SupportingDocStatus),
  supportingDocsNoteEn: z.string().nullable(),
  supportingDocsNoteAs: z.string().nullable(),
  disclaimerEn: z.string(),
  disclaimerAs: z.string(),
});
export type Report = z.infer<typeof Report>;

