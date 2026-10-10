# Product context: KaagazCheck (কাগজ চেক): "Check before you apply"

## Why it exists
Eligible people lose welfare benefits *after* applying: names that don't match across Aadhaar, bank and land records; Aadhaar not seeded to the bank; missing certificates; rejection reasons they cannot understand. Documented example: Rajasthan 2019, only about 23% of registered PM-KISAN farmers got the 3rd instalment, mostly because of Aadhaar name mismatches (sources in `docs/research.md`).

KaagazCheck checks the papers **before** the person applies, in **Assamese (default) with an English toggle**, and says exactly what to fix and where.
**Promise:** we help catch preventable mistakes. We do NOT guarantee approval; the department decides.

## Users
- **Citizen** in Assam (farmer, widow, woman of a household) on a basic Android phone, often helped by family or a CSC/NGO helper.
- **Rule maintainer** (helper organisation) who keeps scheme rules current with the Rule Maintenance Agent (Cline SDK).

## Schemes in scope (rule packs v2, `docs/schemes.md` is the source of truth)
- **PM-KISAN** (`pm-kisan`): flagship end-to-end demo. No landholding-size limit.
- **Orunodoi 3.0, Assam** (`orunodoi-3`): only the ration card and ₹1,250/month are verified; everything else is provisional → "needs verification".
- **Widow Pension IGNWPS** (`nsap-widow`): age 40–79, BPL, central ₹300/month; state top-up unconfirmed.

## Main demo path (3 minutes)
1. Pick a scheme.
2. Add documents: photo, or "Use sample A/B/C" (A clean PM-KISAN, B name mismatch, C widow missing death certificate).
3. AI reads each document → fields + confidence; low confidence → the user confirms or edits.
4. Answer the yes/no questions.
5. Rule engine → **two verdicts**: *Eligibility* (likely_eligible / not_eligible / needs_verification) and *Readiness* (ready_for_review / action_required / needs_verification). Each check has a reason, where to fix it, and its source (provenance, verified vs provisional).
6. Assamese report + printable cover sheet.

## Cline inside the product: Rule Maintenance Agent (T3)
A scheme notice → the agent proposes a rule change (new scheme or new version, with provenance) → writes regression tests → runs them through the engine → diff + test results → a **human approves** → a new rule-pack version is published (old version kept). Demo inputs: `docs/sample-guideline-ignoaps.md` (add a scheme), `docs/sample-notice-orunodoi-oct2026.md` (one-time ₹1,500 for October 2026, via a time-bounded benefit override).

## Second mode (T4)
Rejection decoder: rejection text → known reason code (`src/core/rejectionCodes.ts`) → fix steps in Assamese + English.

## Trust rules
- The AI only reads and explains; the rule engine decides.
- Every rule carries provenance; provisional rules and external facts (bank seeding, account active, eKYC, land verified) → needs_verification, never a definitive pass/fail.
- A fuzzy name score never equals identity: only an exact (normalised) match is `ok`.
- Aadhaar masked to the last 4 digits everywhere; images processed in memory, never stored.
- Demo uses fake sample documents only. AI-generated Assamese is labelled "draft"; fixed Assamese strings need native-speaker review.
