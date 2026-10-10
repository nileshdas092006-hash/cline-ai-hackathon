# System patterns

## Core pipeline: AI reads → rule engine decides → AI explains
1. **Read (AI):** a document image or text → `ExtractedDoc` (fields + per-field confidence), validated with zod.
2. **Decide (pure code):** `evaluate(scheme, docs, answers, asOfDate) → Report` in `src/core/evaluate.ts`. Deterministic, unit- and property-tested. No model text ever decides a status.
3. **Explain (AI, optional):** friendlier Assamese wording or a letter draft, built only from the report's checks (labelled "draft").

## Module boundaries
- `src/core/`: pure TypeScript. No React, network, DB, `process.env` or implicit "today" (`asOfDate` is always passed in).
  - `types.ts` zod schemas: `RuleProvenance`, `SchemeRule` (versioned), `ExtractedDoc`, `Answers`, `Check`, `Report`, `BenefitOn`.
  - `schemes/` rule packs (`pm-kisan.ts`, `orunodoi-3.ts`, `nsap-widow.ts`; provenance helpers in `sources.ts`) + registry `index.ts`: `getScheme(id, version?)`, `listSchemes()`, `listSchemeVersions(id)`, `registerScheme(rule)` (validates; keeps old versions; newest wins), `questionsFor(scheme)`.
  - `nameMatch.ts` (+ `transliterate.ts`), `age.ts` (`ageOn`), `aadhaar.ts` (`maskAadhaar`), `benefit.ts` (`benefitOn` with time-bounded overrides), `rejectionCodes.ts`, `labels.ts` (bilingual doc/office labels, disclaimer), `samples.ts` (fake sample sets A/B/C), `dates.ts`.
- `src/server/ai.ts` (T2): the **only** module that calls a model. Structured JSON → zod → one retry → safe fallback. Logs model, prompt version, input hash (never raw personal data).
- `src/server/store.ts` (T3): the **only** database writer (`node:sqlite`, WAL, transactions); `rule_versions` table.
- `src/server/agent/` (T3): `@cline/sdk` Rule Maintenance Agent; its tools call `src/core` (`registerScheme`, `evaluate`).
- `src/app/api/**/route.ts`: thin handlers with `export const runtime = "nodejs"`.
- `src/app/**`: UI (Assamese default, English toggle; fixed strings in `src/i18n.ts` from T2). Calls API routes, never the model.

## Result model (docs/schemes.md v2)
- Check result: `ok | action_required | needs_verification | not_applicable`; kind: `document | name | field | eligibility | external`. Every check has `messageEn`, `messageAs`, `fixWhere`, `provenance`, plus `match` for name checks.
- **Eligibility:** `not_eligible` only when a **verified** eligibility criterion failed; any provisional, unanswered or unreadable criterion → `needs_verification`; else `likely_eligible`.
- **Readiness:** any `action_required` (missing mandatory doc, name `mismatch`, bad IFSC/account format, failed verified criterion) → `action_required`; else any non-external `needs_verification` (possible match, initials, low confidence, provisional) → `needs_verification`; else `ready_for_review`. External checks (bank seeding, account active, eKYC, land verified, ration card active) are always `needs_verification` and listed, but on their own they don't block `ready_for_review`.
- Money: `centralShare` + `stateTopUp` (null = unconfirmed → `total` null; never show an unconfirmed total). Overrides are inclusive date windows; the last matching one wins.

## Name matching (showcase, defensive)
Tokenise → drop leading honorifics (SHRI/SMT/MR/MRS/KUMARI/LATE…) → transliterate Devanagari/Assamese/Bengali → canonical variants (KR→KUMAR, MD/MOHD→MOHAMMAD, DEBI→DEVI, SK→SHEIKH…). Levels: `same` (identical after formatting; the only level that gives `ok`), `possible_match` (variants, transliteration, word order, or every word pair Jaro-Winkler ≥ 0.85), `initials_only`, `mismatch` (incl. a missing/extra word). The score is shown but never decides.

## Privacy
Aadhaar: only `aadhaarLast4` is stored in `ExtractedDoc`; `maskAadhaar` → `XXXX XXXX 1234`. Images processed in memory only. Minimum personal data.

## Testing
Vitest + fast-check, tests first for core logic. Properties: name same-as-itself, symmetry, mask ≤ 4 digits, possible_match never `ok`, Orunodoi never `not_eligible`, evaluate deterministic + schema-valid, readiness invariant.
