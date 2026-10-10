# Active context

## Current state (after T3)
T3 is done: the **Rule Maintenance Agent** works end to end against the live Cline API. On `/admin` a maintainer pastes a notice or loads a demo notice. A `@cline/sdk` Agent works only through 5 tools (`getRuleSchema`, `getCurrentRule`, `proposeRule`, `runTests`, `saveProposal`), and the page shows a live tool-call log, a readable before/after diff, test results (new + regression), Publish / Reject, and version history per scheme. Published versions are live at once in `/` and `/api/check`, and the old versions are kept.
Live run (smoke, 2026-10-10): the IGNOAPS notice gave new scheme `nsap-old-age` 1.0.0 (5/5 new tests); the Orunodoi notice gave `orunodoi-3` 2.0.0 → 2.1.0 with an Oct 1–31 2026 override (4 new + 4 regression tests pass). After publishing, `/api/check` returns 1500 on 2026-10-15 and 1250 on 2026-11-15, and the home page lists the Old Age Pension.
225 tests pass; typecheck, lint and build are clean.

## Decisions made in T3
- "Type it in": a document counts only once its main field has a value (`MAIN_FIELD` in `docFields.ts`, `isDocAdded` / `countedDocs` in `flow.ts`). Death certificate and BPL proof (nothing is read from them) count as soon as they are added. Only counted docs go to `/api/check` and onto the cover sheet; a started-but-empty slot shows "Type the name on the next screen to add it".
- Code decides everything about a proposal (`rulePolicy.ts`): the version must go up; ≥ 3 new tests with unique ids; a provenance may be `verified` only if it is carried over unchanged or its `sourceUrl` appears in the notice. Otherwise it must be `provisional`, so the engine says needs_verification. `saveProposal` is refused unless every new and regression test passes. `publish` re-runs all checks (a stale proposal cannot go live).
- Regression tests = built-in suites (`schemes/regression.ts`, the "version 1" tests) + the tests of every published version of that scheme.
- The agent edits existing schemes with a JSON merge patch (`mergePatch.ts`, RFC 7386) instead of re-sending the whole rule (fewer tokens, faster demo).
- `ai.ts` also hosts `runToolAgent` (the agent path), so there is still one model module: it logs model / promptVersion / inputHash / toolCalls, retries once only if no tool ran yet, falls back to `{ error }`, and never throws.
- Store = `node:sqlite` file (`KAAGAZ_DB_PATH` or `data/kaagaz.db`). `rule_versions` has extra `notice` and `summary` columns (needed to re-check provenance at publish time and to show the reviewer a summary). A unique partial index allows one published row per scheme+version.
- `/` and `/admin` render per request (`connection()` inside `<Suspense>`); every request calls `syncRegistry()` (idempotent), so versions published by any process appear immediately.
- `/admin` is English-only (for maintainers, not citizens). There is no auth on `/admin`; see Requests for Claude in LOG.md.

## Previous state (after T2)
T2 (main flow) is done. One mobile flow on `/` (client component `src/app/_components/KaagazApp.tsx`): scheme cards (PM-KISAN first, "flagship") → documents (photo per slot via `/api/extract`, "type it in", or samples A/B/C with a purple "Demo mode: fake sample documents" label) → confirm fields (low confidence in amber) → big Yes/No questions → report from `/api/check`. The report shows the Eligibility banner, the Readiness banner (+ "check at the bank" list), Fix before you apply, Please verify, OK (collapsed), benefit (central / state top-up separately), supporting docs, a print-only cover sheet and the bilingual disclaimer. Assamese default, English toggle (`src/i18n.ts`).
150 tests pass; typecheck, lint and build are clean. The live Cline API reads a fake Aadhaar image correctly (image input works).

## Decisions made in T2
- `src/server/ai.ts` is the only model caller: `extractDocument(image, hint?, deps?)` → `{ doc, detectedDocType } | { error: ai_unavailable | ai_failed | invalid_image }`, one retry, logs only model/promptVersion/inputHash/outcome. The Cline API wraps responses as `{ data: { choices } }`; both shapes are handled.
- Raw model JSON → `ExtractedDoc` in pure `src/core/extraction.ts` (full Aadhaar → last 4; unscored AI fields → 0.5 confidence so they get confirmed; non-ISO DOB → low confidence).
- Route files do NOT export `runtime = "nodejs"`: Next 16.4 rejects it with `cacheComponents` (Node is the default anyway). Awaiting Claude's confirmation.
- Nothing is read from the death certificate or BPL proof (presence only); `husbandName` is not collected.
- The client never imports the engine: UI helpers live in `flow.ts`, `reportView.ts`, `catalog.ts`, `thresholds.ts`; the page (a server component) passes a plain `SchemeView[]` catalog.
- "Type it in" adds an empty document (counted as present by the engine); flagged for Claude.

## Decisions made in T1
- Brief v2: **Assamese default + English**; two verdicts (eligibility, readiness); provenance on every rule (verified vs provisional).
- `RuleProvenance.sourceUrl` is nullable, but a `verified` rule must have one (schema refine). Provisional overrides from the T3 agent can start with `sourceUrl: null`.
- `ExtractedDoc.fields` is strict and only holds `aadhaarLast4` (never a full Aadhaar number). A missing per-field confidence means "entered/confirmed by the user"; < 0.8 → needs_verification.
- The name reference document is Aadhaar for PM-KISAN and the widow pension, and the ration card for Orunodoi.
- A PM-KISAN land-owner mismatch becomes `needs_verification` (not ok) if the user answers `land_in_family_member_name` = yes (farmer family = spouse/minor children).
- Orunodoi question ids: `nfsa_enrolled` (requirement); any-of `widow | person_with_disability | aay_card | income_below_2_lakh`; exclusions `elected_representative | professional | govt_staff_or_pensioner | contractor_or_trader | large_landholder | four_wheeler | similar_state_scheme`. All provisional.
- Widow pension: all mandatory docs (incl. `bpl_proof`) are provisional ("commonly required; confirm locally"); age and BPL are verified.
- The registry is in-memory: `registerScheme` validates, rejects a duplicate id+version and keeps old versions. T3 will persist versions in SQLite and register them at startup.
- Assamese strings in `labels.ts`, the scheme packs and `rejectionCodes.ts` are drafts awaiting native-speaker review (Das).

## Next step
T4: rejection decoder + polish. Before the demo: a phone click-through of `/` and `/admin`, native-speaker review of `src/i18n.ts` and of the Assamese text the agent writes, and a decision on protecting `/admin`.
