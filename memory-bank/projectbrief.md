# Project brief v2: KaagazCheck (কাগজ চেক): "Check before you apply"

**Pitch:** We help citizens catch preventable welfare-application mistakes *before* they submit their papers. Our AI reads the documents; a tested rule engine checks them; and Cline maintains the rules as official guidelines change.
**Promise:** we reduce preventable errors. We do NOT guarantee approval; the department decides.

## Problem (evidence: docs/research.md)
Eligible people lose benefits after applying because their documents disagree (name spellings across Aadhaar, bank and land record; account not Aadhaar-seeded; missing papers) or because rejections arrive unexplained. In Rajasthan in 2019, only about 23% of registered PM-KISAN farmers got the third instalment, mostly due to name mismatches with Aadhaar.

## Users
- **Citizen** in Assam on a basic Android phone, often helped by family or a CSC/NGO helper.
- **Rule maintainer** (helper organisation) who keeps scheme rules current using the Cline agent.

## Languages
**Assamese (default) + English toggle.** All fixed UI and check messages live in one `src/i18n.ts` with `as` and `en` keys. Assamese strings must be reviewed by a native speaker before the demo (Das will arrange). AI-generated Assamese (letters, explanations) is labelled "draft".

## Scope: rule packs v2 (docs/schemes.md is the source of truth)
- **PM-KISAN: flagship, full end-to-end demo** (name mismatch, missing document, uncertain bank status).
- **Orunodoi 3.0: Assam relevance, verified rules only;** provisional criteria → "needs verification".
- **Widow Pension (IGNWPS): simple, reliable rules** (age 40–79, BPL, central ₹300/month).

## Architecture (the trust design)
1. **Document reader (AI):** extracts names, dates, account details and document type, with per-field confidence. Low confidence → user confirms.
2. **Deterministic rule engine (pure code, tested):** normalises fields, checks consistency, evaluates verified criteria, finds missing documents. Provisional rules and external facts → `needs_verification`.
3. **Two separate verdicts:** *Eligibility* (likely_eligible / not_eligible / needs_verification) and *Readiness* (ready_for_review / action_required / needs_verification).
4. **Next steps:** corrections, where to go (bank, Aadhaar centre, circle office, Gram Panchayat), the source of each rule, and a printable cover sheet.
5. **Explainer (AI, optional):** friendly wording in Assamese, built only from the engine's result.

## Core loop (must-ship demo path)
Pick scheme → add documents (photo, or "Use sample A/B/C") → confirm low-confidence fields → answer yes/no questions → two-verdict report with fixes and sources → print cover sheet.
Samples (clearly fake): A = clean PM-KISAN farmer → ready_for_review (+ bank seeding needs verification). B = PM-KISAN with "RAMESH KR SHARMA" (bank, possible match) and "Rameshwar Sharma" (land record, mismatch) → action_required. C = widow pension, missing death certificate → action_required.

## Cline inside the product: Rule Maintenance Agent (T3)
Upload or paste a scheme notice → a `@cline/sdk` Agent proposes a **rule change** (new scheme or edited rule, with provenance: sourceUrl, clause, effectiveDate) → writes **regression tests** → runs them through the engine (existing scheme tests must still pass) → shows a diff + test results → a **human approves** → a new rule-pack version is published (old version kept). Demo inputs: `docs/sample-guideline-ignoaps.md` (add a scheme) and `docs/sample-notice-orunodoi-oct2026.md` (a one-time payment change, to show versioning).

## Trust rules (non-negotiable)
- AI reads and explains; **code decides**. No eligibility claim from model text.
- Aadhaar masked to the last 4 digits everywhere; images processed in memory, never stored.
- Every rule carries provenance; provisional → needs_verification.
- A fuzzy name score never equals identity.
- Demo uses fake documents only.

## Data model sketch
- `RuleProvenance` { sourceUrl, sourceTitle, clause?, effectiveDate?, verifiedOn, version, status: verified | provisional }
- `SchemeRule` { id, version, nameEn, nameAs, benefit { centralShare, stateTopUp|null, period, effectiveDate, provenance }, mandatoryDocs[], supportingDocs[], ageRange?, eligibilityAnyOf[], exclusions[], externalChecks[], each criterion with provenance }
- `ExtractedDoc` { docType, fields { name, dob, aadhaarLast4, accountNo, ifsc, ownerNames[], husbandName, ... }, confidence per field }
- `Report` { eligibility, readiness, checks[], schemeVersion, asOfDate }
- DB (T3): `rule_versions` { schemeId, version, ruleJson, testsJson, testResultJson, status: proposed | published | rejected, sourceNote, createdAt, approvedAt }

## Stretch
Assamese voice readout (only if the browser has an as-IN voice; otherwise hide) · rejection-notice decoder (T4) · helper mode for many applicants.

## Cut list (cut in this order)
Voice → decoder letter drafting → real photo upload (keep samples + manual entry) → cover-sheet styling. **Never cut:** the two-verdict report, provenance, the Cline agent with tests + approval.
