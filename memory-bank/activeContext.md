# Active context

## Current state
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
T3: Rule Maintenance Agent (`@cline/sdk`, `node:sqlite` `rule_versions`, regression tests + human approval, versioned packs). Before the demo: a phone click-through of the T2 flow and native-speaker review of `src/i18n.ts`.
