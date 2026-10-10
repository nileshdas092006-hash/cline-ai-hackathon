// Built-in regression tests for the built-in rule packs (stored as their version-1 tests).
// Every new version of a scheme must still pass these, plus the tests of every published version.
// Pure data, validated by RuleTestCase. People and numbers are fake.
import { RuleTestCase } from "../ruleTests";
import { SAMPLES } from "../samples";
import type { ExtractedDoc } from "../types";

const AS_OF = "2026-10-10";

const orunodoiDocs: ExtractedDoc[] = [
  { docType: "ration_card", fields: { name: "Anjali Bora" }, confidence: {} },
  { docType: "aadhaar", fields: { name: "Anjali Bora", dob: "1980-05-05", aadhaarLast4: "2290" }, confidence: {} },
  { docType: "bank_passbook", fields: { name: "ANJALI BORA", accountNo: "50011122233", ifsc: "SBIN0004567" }, confidence: {} },
];
const orunodoiAnswers = {
  nfsa_enrolled: true,
  widow: true,
  elected_representative: false,
  professional: false,
  govt_staff_or_pensioner: false,
  contractor_or_trader: false,
  large_landholder: false,
  four_wheeler: false,
  similar_state_scheme: false,
};

const widowDocs = (dob: string): ExtractedDoc[] => [
  { docType: "aadhaar", fields: { name: "Sunita Devi", dob, aadhaarLast4: "7315" }, confidence: {} },
  { docType: "death_certificate", fields: {}, confidence: {} },
  { docType: "bank_passbook", fields: { name: "SUNITA DEVI", accountNo: "40098765432", ifsc: "UTBI0ABC123" }, confidence: {} },
  { docType: "bpl_proof", fields: {}, confidence: {} },
];
const widowYes = { is_widow: true, bpl_household: true };

export const BUILTIN_REGRESSION_TESTS: Record<string, RuleTestCase[]> = {
  "pm-kisan": RuleTestCase.array().parse([
    {
      kind: "evaluate",
      id: "pmk_sample_a_ready",
      description: "Sample A (papers in order) → likely eligible, ready for review; bank seeding still to confirm",
      asOfDate: AS_OF,
      docs: SAMPLES.A.docs,
      answers: SAMPLES.A.answers,
      expect: { eligibility: "likely_eligible", readiness: "ready_for_review", checks: { ext_aadhaar_bank_seeding: "needs_verification" } },
    },
    {
      kind: "evaluate",
      id: "pmk_sample_b_names",
      description: "Sample B → land-record name mismatch must be fixed; bank name is only a possible match",
      asOfDate: AS_OF,
      docs: SAMPLES.B.docs,
      answers: SAMPLES.B.answers,
      expect: { readiness: "action_required", checks: { name_land_record: "action_required", name_bank_passbook: "needs_verification" } },
    },
    {
      kind: "evaluate",
      id: "pmk_income_tax_excluded",
      description: "Income-tax payer (verified exclusion) → not eligible",
      asOfDate: AS_OF,
      docs: SAMPLES.A.docs,
      answers: { ...SAMPLES.A.answers, income_tax_payer: true },
      expect: { eligibility: "not_eligible" },
    },
    {
      kind: "benefit",
      id: "pmk_benefit_6000",
      description: "₹6,000 a year from the central government",
      date: AS_OF,
      expect: { centralShare: 6000, total: 6000, period: "year", isOverride: false },
    },
  ]),
  "orunodoi-3": RuleTestCase.array().parse([
    {
      kind: "evaluate",
      id: "oru_clean_ready",
      description: "Ration card + matching names + clean answers → likely eligible, ready for review",
      asOfDate: AS_OF,
      docs: orunodoiDocs,
      answers: orunodoiAnswers,
      expect: { eligibility: "likely_eligible", readiness: "ready_for_review", checks: { ext_ration_card_valid: "needs_verification" } },
    },
    {
      kind: "evaluate",
      id: "oru_no_ration_card",
      description: "No ration card (verified requirement) → action required",
      asOfDate: AS_OF,
      docs: orunodoiDocs.filter((d) => d.docType !== "ration_card"),
      answers: orunodoiAnswers,
      expect: { readiness: "action_required", checks: { doc_ration_card: "action_required" } },
    },
    {
      kind: "evaluate",
      id: "oru_four_wheeler_provisional",
      description: "Four-wheeler (provisional exclusion) → needs verification, never not eligible",
      asOfDate: AS_OF,
      docs: orunodoiDocs,
      answers: { ...orunodoiAnswers, four_wheeler: true },
      expect: { eligibility: "needs_verification", checks: { excl_four_wheeler: "needs_verification" } },
    },
    {
      kind: "benefit",
      id: "oru_benefit_1250",
      description: "₹1,250 a month, the regular amount (September 2026)",
      date: "2026-09-15",
      expect: { centralShare: 0, stateTopUp: 1250, total: 1250, period: "month", isOverride: false },
    },
  ]),
  "nsap-widow": RuleTestCase.array().parse([
    {
      kind: "evaluate",
      id: "wid_sample_c_missing_death_cert",
      description: "Sample C → death certificate missing, action required",
      asOfDate: AS_OF,
      docs: SAMPLES.C.docs,
      answers: SAMPLES.C.answers,
      expect: { readiness: "action_required", checks: { doc_death_certificate: "action_required" } },
    },
    {
      kind: "evaluate",
      id: "wid_age_58_ok",
      description: "Widow aged 58 with all papers → likely eligible",
      asOfDate: AS_OF,
      docs: widowDocs("1968-07-01"),
      answers: widowYes,
      expect: { eligibility: "likely_eligible", checks: { age: "ok" } },
    },
    {
      kind: "evaluate",
      id: "wid_age_39_not_eligible",
      description: "Aged 39 (verified 40–79 limit) → not eligible",
      asOfDate: AS_OF,
      docs: widowDocs("1986-10-11"),
      answers: widowYes,
      expect: { eligibility: "not_eligible", checks: { age: "action_required" } },
    },
    {
      kind: "benefit",
      id: "wid_benefit_300",
      description: "₹300 a month central share; state top-up unconfirmed, so no total",
      date: AS_OF,
      expect: { centralShare: 300, stateTopUp: null, total: null, period: "month" },
    },
  ]),
};
