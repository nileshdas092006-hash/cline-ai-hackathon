# Rule packs v2: the three schemes (corrected 10 Oct 2026)

Source of truth for the rule engine. v2 applies corrections from a check against government sources: widow pension age and amount, PM-KISAN bank checks, and Orunodoi 3.0 rules downgraded to provisional.

## Golden rules for every rule
1. **Every rule carries provenance:** `sourceUrl`, `sourceTitle`, `clause` (if known), `effectiveDate` (if known), `verifiedOn` (2026-10-10), `version`, and `status: verified | provisional`.
2. **Provisional rules never give a definitive pass or fail.** They return `needs_verification` with "confirm at the office" and say what to ask.
3. **Document photos can't prove external facts.** Whether a bank account is active or Aadhaar-seeded, whether land is verified, whether eKYC is done: these are `needs_verification` (the user confirms, or checks the official status page), never `pass` from a photo.
4. **Fuzzy name matching never proves identity.** See "Name consistency" below.
5. **Eligibility and readiness are reported separately.** Eligible ≠ application complete, and complete ≠ government approval.
6. **Money values are versioned and split:** `centralShare`, `stateTopUp` (null = unconfirmed), `effectiveDate`, and `source`. Never show an unconfirmed total.

## Result model
- **Eligibility:** `likely_eligible` · `not_eligible` (a verified criterion failed) · `needs_verification`
- **Readiness:** `ready_for_review` (no known issues found by our checks) · `action_required` (mismatch, missing mandatory document, unmet verified criterion) · `needs_verification` (unclear image, provisional rule, external status we can't see)
- Each check has `{ id, result: ok | action_required | needs_verification | not_applicable, messageEn, messageAs, fixWhere, ruleProvenance }`.
- Wording promise: "We help you catch preventable mistakes. We do not guarantee approval; the department decides."

---

## 1. PM-KISAN (id `pm-kisan`): the FLAGSHIP end-to-end demo
sourceUrl: https://pmkisan.gov.in/ · summary: https://en.vikaspedia.in/viewcontent/agriculture/policies-and-schemes/crops-related/comprehensive-guide-to-the-pradhan-mantri-kisan-samman-nidhi-(pm-kisan)-scheme?lgn=en · status: verified (core criteria)

- Benefit: ₹6,000/year in 3 instalments of ₹2,000 by DBT (centralShare 6000/yr, stateTopUp 0).
- Eligible: a landholding farmer family (husband, wife, minor children) owning cultivable land per state land records, **regardless of holding size** (the earlier 2-hectare limit was removed in 2019). **Do not add any landholding-size limit.**
- Exclusions (verified; any "yes" → not_eligible): `holds_constitutional_post`, `govt_employee` (serving or retired; not MTS, Class IV or Group D), `income_tax_payer` (last assessment year), `practising_professional` (doctor, engineer, lawyer, CA, architect), `pension_10k_plus` (₹10,000+/month; not MTS, Class IV or Group D).
- Mandatory documents: `aadhaar`, `bank_passbook`, `land_record`.
- Document-level checks (our engine CAN decide): all mandatory docs present; name consistency across aadhaar, bank_passbook and land_record; IFSC format `^[A-Z]{4}0[A-Z0-9]{6}$`; account number present (9–18 digits); the land record shows the applicant (or a family member) as owner.
- External checks (always `needs_verification`, with how to check): Aadhaar seeded to the bank account (ask at the bank branch); account active; eKYC done (PM-KISAN portal OTP, or CSC biometric); land verified by the state.

## 2. Orunodoi 3.0, Assam (id `orunodoi-3`): local relevance, verified rules only
Official page: https://dhemaji.assam.gov.in/scheme-page/orunodoi (Govt of Assam, last updated 8 May 2025). Secondary: https://www.publicservicesmap.in/schemes/orunodoi-3.0--aos?lang=en

**Verified (from the official page):**
- Benefit: ₹1,250/month to families with **valid ration cards** (centralShare 0, stateTopUp 1250, recurring). Note: a reported one-time ₹1,500 payment for October 2026 is a temporary change; don't treat it as the recurring amount.
- **No income certificate required** (official page says so).
- Mandatory: valid ration card. Preliminary selection is "based on eligibility/ineligibility conditions" through an undertaking-cum-checklist (Annexure A).

**Provisional (secondary sources, or the 2020 original guideline; NOT confirmed for 3.0):**
- The NFSA enrolment precondition (myScheme lists it; the official page says "valid ration card").
- The eligibility any-of list (widow, PwD, AAY, household income under ₹2 lakh, etc.).
- The whole exclusion list (elected representatives, professionals, teachers, government staff and pensioners, contractors, traders, large landholders, four-wheeler owners, similar state cash schemes).
- Supporting documents (Aadhaar, bank passbook, voter ID, age proof, address proof, self-declaration).

**Engine behaviour:** the ration card is a mandatory check (missing → action_required). Each provisional criterion is asked as a question, and any answer that would exclude → `needs_verification` ("This may make you ineligible. Confirm at the Gram Panchayat."), never `not_eligible`. Supporting documents are shown as a checklist labelled "commonly asked; confirm the current list".
- Name consistency across ration_card, aadhaar and bank_passbook (if provided).

## 3. Widow Pension, IGNWPS under NSAP (id `nsap-widow`): the simple, reliable rule demo
sourceUrl: https://www.publicservicesmap.in/schemes/indira-gandhi-national-widow-pension-scheme--ignwps (aligns with the Ministry of Rural Development statement cited by the reviewer) · status: verified (age, BPL, central amount)

- Eligible: widow, **age 40–79 inclusive**, household **BPL** per GoI criteria.
- Age: computed from the Aadhaar DOB **on an explicit `asOfDate`** (default today; injectable for tests).
- Benefit: **centralShare ₹300/month** (ages 40–79); stateTopUp for Assam = null (unconfirmed → show "plus any state top-up; confirm locally").
- Mandatory (provisional list; the source has no official document list): `aadhaar`, `death_certificate` (husband), `bank_passbook`; BPL proof. Mark the list as "commonly required; confirm locally".
- Checks: age window (verified → can say not_eligible); `bpl_household` question (no → not_eligible); name consistency across aadhaar and bank_passbook; death certificate present (missing → action_required).
- Age below 40 → not_eligible. Age 80+ → not_eligible for the widow pension band here; suggest checking the Old Age Pension (a scheme the agent can onboard in the demo).

---

## Name consistency (core showcase, defensive version)
Output levels, from strongest to weakest:
- `same`: identical after formatting normalisation (case, punctuation, extra spaces, joined vs spaced words, honorifics SHRI/SMT/MR/MRS/KUMARI/LATE). → check `ok`.
- `possible_match`: differs only by known abbreviations or variants (KR↔KUMAR, MD/MOHD↔MOHAMMAD, DEVI↔DEBI, SK↔SHEIKH), transliteration (Devanagari/Assamese/Bengali script ↔ Latin), or Jaro-Winkler ≥ 0.85 on the normalised form. → `needs_verification`: "These look like the same person written differently. Officials may still reject this. Ask the bank/Aadhaar centre to make them identical."
- `initials_only`: "R. KUMAR" vs "RAMESH KUMAR" → `needs_verification`.
- `mismatch`: below that threshold (e.g. "Rameshwar Sharma" vs "Ramesh Kumar Sharma", "Ramesh" vs "Suresh") → `action_required`, saying which document to correct and where.
- The score is shown for transparency but **never** turns a check into `ok` by itself; only `same` does.
