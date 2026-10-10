# T1: Core rule engine v2, tests first (about 75 min)

Mode: ACT. Pure TypeScript in `src/core/` only: no UI, network, AI or DB imports. **Read `docs/schemes.md` (rule packs v2) first; it is the source of truth.**

1. `src/core/types.ts` + zod schemas: `RuleProvenance`, `SchemeRule` (with `version`), `ExtractedDoc`, `Answers`, `Check`, `Report` (two verdicts: `eligibility`, `readiness`), as in memory-bank/projectbrief.md.
2. `src/core/schemes/pm-kisan.ts`, `orunodoi-3.ts`, `nsap-widow.ts`: data validated by `SchemeRule`. Every criterion and benefit has provenance with `status: verified | provisional` exactly as docs/schemes.md marks it. Question text in Assamese + English. Registry: `getScheme(id)`, `listSchemes()`, `registerScheme(rule)` (used by T3).
3. `src/core/nameMatch.ts` → `{ level: same | possible_match | initials_only | mismatch, score }` per docs/schemes.md. Normalisation, honorifics, abbreviations, transliteration of Devanagari and Assamese/Bengali script to Latin (basic table), Jaro-Winkler.
4. `src/core/age.ts`: age on an explicit `asOfDate`.
5. `src/core/aadhaar.ts`: `maskAadhaar()` → `XXXX XXXX 1234`.
6. `src/core/benefit.ts`: `benefitOn(scheme, date)`, supporting time-bounded overrides (needed for the T3 demo).
7. `src/core/evaluate.ts`: `evaluate(scheme, docs, answers, asOfDate) → Report`. Rules:
   - verified criterion failed → eligibility `not_eligible`
   - provisional criterion triggered → `needs_verification` (never not_eligible)
   - missing mandatory doc or a name `mismatch` → readiness `action_required`
   - `possible_match`, `initials_only`, low-confidence field, or any external check (bank seeding, account active, eKYC, land verified) → `needs_verification`
   - otherwise `ready_for_review`
   - Each check has `messageEn`, `messageAs`, `fixWhere`, `provenance`.
8. `src/core/rejectionCodes.ts`: enum (`NAME_MISMATCH_AADHAAR`, `AADHAAR_NOT_SEEDED_BANK`, `INVALID_ACCOUNT_IFSC`, `ACCOUNT_INACTIVE`, `LAND_NOT_VERIFIED`, `EKYC_PENDING`, `PENDING_STATE_ACTION`, `UNKNOWN`) → fix steps in English + Assamese.

**Tests (write first):**
- nameMatch: "Ramesh Kumar" vs "RAMESH KUMAR " → same; "RAMESHKUMAR" vs "Ramesh Kumar" → same; "Smt. Sunita Devi" vs "SUNITA DEBI" → possible_match; "RAMESH KR SHARMA" vs "Ramesh Kumar Sharma" → possible_match; "R. Kumar" vs "Ramesh Kumar" → initials_only; "Rameshwar Sharma" vs "Ramesh Kumar Sharma" → mismatch; "Ramesh" vs "Suresh" → mismatch.
- fast-check: a name is `same` as itself; level is symmetric; `maskAadhaar` never outputs more than 4 digits; **possible_match never yields an `ok` check**.
- evaluate, PM-KISAN: clean → ready_for_review with bank seeding as needs_verification; bank "RAMESH KR SHARMA" → needs_verification; land "Rameshwar Sharma" → action_required (fixWhere circle office); missing land_record → action_required; income tax yes → not_eligible; large landholding has NO effect (regression test for the removed 2-ha limit).
- evaluate, widow: age 39 → not_eligible; 40 → likely_eligible; 79 → likely_eligible; 80 → not_eligible; benefit centralShare 300; stateTopUp null.
- evaluate, Orunodoi: no ration card → action_required; four-wheeler yes → needs_verification (not not_eligible).
- benefitOn: Orunodoi with a 2026-10 override → 1500 in October, 1250 in November.

**Done when:** all tests pass, typecheck clean, LOG.md updated, committed "T1: core rule engine v2".
