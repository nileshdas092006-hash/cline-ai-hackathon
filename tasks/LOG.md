# Build log (Cline appends after every task)

## T0: scaffold + memory bank (run-133358-c1ef, 2026-10-10)
Followed the plan from run-133031-4cma.

**Files created/changed**
- Memory Bank: `memory-bank/productContext.md`, `systemPatterns.md`, `techContext.md`, `activeContext.md`, `progress.md` (`projectbrief.md` untouched).
- Scaffold (create-next-app@16.4.0 in a temp folder, copied in): `package.json`, `package-lock.json`, `tsconfig.json` (strict), `next.config.ts`, `eslint.config.mjs` (+ ignores for `.cline-runs/`, `docs/`, `memory-bank/`, `tasks/`), `next-env.d.ts`, `AGENTS.md`, `public/*`, `src/app/{layout.tsx,page.tsx,globals.css,favicon.ico}`.
- New: `src/core/appInfo.ts` (title/taglines, pure), `src/core/appInfo.test.ts` (smoke test, also exercises zod + fast-check), `vitest.config.mts`, `.env.example` (`CLINE_API_KEY=`, `CLINE_MODEL=`), `README.md` (short placeholder), `.gitignore` (ignores `.env`, `.env*.local`, `node_modules`, `.next`, `*.db*`; keeps `.env.example` and `.cline-runs/`).
- Deps added: `zod@^4.6.5`, dev `vitest@^5.0.3`, `fast-check@^4.10.2`, `@types/node@^22`.
- Scripts: `dev`, `build`, `start`, `lint` (`eslint .`), `typecheck` (`tsc --noEmit`), `test` (`vitest run`), `test:watch`.

**Results**
- `npm test`: 1 file, 3 passed, 0 failed.
- `npm run typecheck`: pass. `npm run lint`: pass (0 problems). `npm run build`: pass (Next 16.4.0, Turbopack; `/` prerendered static).
- Verified the built HTML contains "KaagazCheck: कागज़ चेक" and `lang="hi"`, and the CSS contains the Tailwind utilities used.

**Deviations from the plan**
- `@types/node` bumped from `^20` to `^22` (Vitest 5 peer requirement; matches Node 22+).
- Vitest config is `.mts` instead of `.ts` (avoids a Vite ESM/CJS config warning).
- `layout.tsx` uses explicit `Readonly<{ children: React.ReactNode }>` instead of the generated global `LayoutProps<"/">`, so `typecheck` passes before `.next/types` exists.
- No `postcss.config.mjs`: create-next-app 16.4 wires Tailwind v4 via the `@tailwindcss/turbopack` loader in `next.config.ts`; Tailwind confirmed working in the build.

**Open issues**
- npm warns `eslint@9` is deprecated (pinned by eslint-config-next 16.4.0) and that `unrs-resolver` has an unapproved postinstall script; neither blocks lint or build.
- `docs/sample-notice-orunodoi-oct2026.md` appeared in `docs/` during this run (not created by Cline); committed as-is with `git add -A`.

**Requests for Claude**
- None blocking. Please confirm that `docs/sample-notice-orunodoi-oct2026.md` is intended for T4 (rejection decoder) and reference it in the task spec if so.

## T1: core rule engine v2 (run-134715-f3yl, 2026-10-10)
Followed `tasks/NEXT.md` (Step 0 + `tasks/backlog/T1-core-engine.md`), with `docs/schemes.md` v2 as the source of truth. I wrote the tests first: all new test files were written before the implementations, and the Step 0 smoke tests failed until `appInfo.ts` was updated.

**Step 0**
- Memory bank: `productContext.md`, `systemPatterns.md`, `activeContext.md` rewritten for brief v2 (two verdicts, provenance, Assamese). `progress.md` and `techContext.md` updated.
- `src/core/appInfo.ts`: `APP_TITLE` "KaagazCheck: কাগজ চেক", `APP_TAGLINE_EN` "Check before you apply", `APP_TAGLINE_AS` "আবেদনৰ আগতে পৰীক্ষা কৰক", `APP_LANG = "as"`, and a longer `APP_DESCRIPTION_EN` for meta. `layout.tsx` uses `lang={APP_LANG}`; `page.tsx` shows the Assamese tagline first. The smoke test checks the exact title and taglines, Assamese ৰ (U+09F0) rather than Bengali র, and `lang`.

**Files created (all pure, in `src/core/`)**
- `types.ts`: zod schemas `RuleProvenance`, `SchemeRule` (with `version`), `ExtractedDoc`, `Answers`, `Question`, `DocRequirement`, `NameCheckRule`, `FieldCheckRule`, `ExternalCheckRule`, `AgeRange`, `Benefit` (+ `BenefitOverride`), `Check`, `Report`, `BenefitOn`.
- `schemes/sources.ts` (provenance builders, verifiedOn 2026-10-10), `schemes/pm-kisan.ts`, `schemes/orunodoi-3.ts`, `schemes/nsap-widow.ts`, `schemes/index.ts` (`getScheme`, `listSchemes`, `listSchemeVersions`, `registerScheme`, `questionsFor`).
- `nameMatch.ts` (+ `transliterate.ts`: Devanagari and Assamese/Bengali → Latin), `age.ts`, `aadhaar.ts`, `benefit.ts`, `evaluate.ts`, `rejectionCodes.ts`, `labels.ts`, `samples.ts` (fake samples A/B/C), `dates.ts`.
- Tests: `nameMatch.test.ts`, `age.test.ts`, `aadhaar.test.ts`, `benefit.test.ts`, `evaluate.test.ts`, `rejectionCodes.test.ts`, `schemes/schemes.test.ts`.

**Results**
- `npm test`: 8 files, **93 passed, 0 failed** (including fast-check properties: same-as-itself, symmetry, mask ≤ 4 digits, possible_match never ok, Orunodoi never not_eligible, deterministic + schema-valid report, readiness invariant).
- `npm run typecheck`: pass. `npm run lint`: pass. `npm run build`: pass. The built HTML has `lang="as"`, the Assamese title and both taglines, and no Devanagari.
- Required name cases and their scores: same (1) / same (1) / possible_match (0.999) / possible_match (0.999) / initials_only (0.875) / mismatch (0.644) / mismatch (0.778).
- Samples on 2026-10-10: A → likely_eligible + ready_for_review (4 external checks need verification). B → action_required (bank possible_match, land mismatch). C → action_required (death certificate missing).

**Design decisions / interpretations (please review)**
- **Readiness with external checks:** external checks are always `needs_verification` but do not by themselves stop `ready_for_review`. This is needed for the T1 spec "clean → ready_for_review with bank seeding as needs_verification". Any other `needs_verification` (possible match, initials, low confidence < 0.8, provisional criterion, unanswered question) → readiness `needs_verification`.
- **A verified criterion that fails** (e.g. income tax payer) → eligibility `not_eligible` and readiness `action_required`.
- **Name `same`** means identical after formatting (case, punctuation, spaces, joined words, leading honorifics), compared in the original script. Any cross-script comparison is at best `possible_match`. The score is capped at 0.999 for anything that is not `same`. `possible_match` also covers reordered words and "every word pair Jaro-Winkler ≥ 0.85". A missing or extra word is a `mismatch` (so "Rameshwar Sharma" vs "Ramesh Kumar Sharma" is a mismatch).
- **Honorifics** are dropped only when they lead the name, so "Sunita Kumari" keeps KUMARI as a surname.
- **PM-KISAN land owner:** a mismatch becomes `needs_verification` (never ok) if the user answers `land_in_family_member_name` = yes. docs/schemes.md allows "applicant (or a family member) as owner". The relationship can't be proven from a photo.
- **Orunodoi** name checks use the ration card as the reference. Provisional questions are `nfsa_enrolled`, an any-of list and 7 exclusions. "None of the any-of conditions" → `needs_verification`. `ration_card_valid` is an external check.
- **Widow pension** mandatory docs include `bpl_proof`, all provisional (docs/schemes.md: "commonly required; confirm locally"). A DOB that is low-confidence, unreadable or missing → age `needs_verification`, never `not_eligible`.
- `RuleProvenance.sourceUrl` is nullable for provisional rules (needed for the T3 Orunodoi override "provisional until an official notice URL is added"). A schema refine stops a `verified` rule from having a null URL.
- `benefitOn`: overrides are inclusive date windows and the last match wins. `total` is null when `stateTopUp` is null.
- The registry is in-memory and keeps old versions. `getScheme(id)` returns the newest version; `getScheme(id, version)` returns that version.

**Open issues**
- All Assamese strings (scheme questions, labels, check messages, rejection fix steps, tagline) are drafts and need native-speaker review (Das).
- The transliteration table is basic (no conjunct special cases beyond virama; schwa deletion only at word end).
- The registry test registers `nsap-widow@2.1.0` in the shared in-memory registry. Vitest isolates test files, so other files are unaffected.

**Requests for Claude**
- Please confirm the readiness rule for external checks (they don't block `ready_for_review` on their own), or say if you want a different label, e.g. `ready_for_review` with a "confirm these N items" list. T2's UI will show them as a separate "confirm at bank/portal" group.
- Please confirm the Orunodoi any-of list and the widow pension `bpl_proof` document are wanted as modelled.


## T2: main flow (run-144641-b8cr, 2026-10-10)
Followed `tasks/NEXT.md` (T2 + adjustments) and `tasks/backlog/T2-main-flow.md`. I wrote tests first for every new pure module and for both API routes. One mobile flow: scheme → documents → confirm fields → questions → two-verdict report → print cover sheet.

**Files created**
- Pure core (tested): `src/core/extraction.ts` (raw model JSON → strict `ExtractedDoc`; DD/MM/YYYY → ISO; full Aadhaar → last 4 digits; AI-read fields without a score get confidence 0.5 so they are always confirmed), `src/core/docFields.ts` (which fields each doc type needs), `src/core/flow.ts` (document slots, field edit/confirm, upsert/remove, relevant answers), `src/core/reportView.ts` (fix / verify / external / ok sections, 🟢🔴🟡⚪ tones, `₹1,25,000` formatting, benefit view), `src/core/catalog.ts` (serialisable scheme list, PM-KISAN first as flagship), `src/core/thresholds.ts`.
- `src/i18n.ts`: all fixed UI strings, `as` (default) + `en`, same keys (tested), with doc/office names reused from `labels.ts`.
- `src/server/ai.ts`: the only model caller. Cline API chat/completions with an `image_url` part, then JSON extraction, zod `RawExtraction`, `toExtractedDoc`, one retry, then `{ error }` (`ai_unavailable` | `ai_failed` | `invalid_image`). `fetch`/`env`/`log` are injectable for tests. Logs `{ model, promptVersion: "extract-doc-v1", inputHash (sha256/16), attempt, outcome, ms }` only.
- `src/server/api.ts` + `src/app/api/check/route.ts`, `src/app/api/extract/route.ts` (thin). `/api/check` validates with zod (strict `ExtractedDoc`, so a full Aadhaar is rejected), 404 for an unknown scheme/version, `asOfDate` defaults to today in IST. Error bodies hold only paths and codes, never submitted values.
- UI (`src/app/_components/`): `KaagazApp` (state + steps), `SchemeStep`, `DocsStep` (photo per slot with camera capture, browser downscale to JPEG ≤1600px, "type it in", samples A/B/C for the chosen scheme), `ConfirmStep` (low confidence highlighted in amber, "This is correct" button), `QuestionsStep` (big Yes/No, "rule not confirmed" badge), `ReportStep` + `CheckItem` + `BenefitCard`, `CoverSheet` (print only, masked Aadhaar, no account number), `ui.tsx`, `image.ts`.
- `scripts/smoke.mjs`: manual smoke test against a running server (not part of `npm test`).
- Tests: `src/core/{extraction,flow,reportView,catalog}.test.ts`, `src/i18n.test.ts`, `src/server/{ai,apiCheck,apiExtract}.test.ts` (ai.ts mocked in the API tests; `fetch` injected in the ai tests; no network).

**Files changed**
- `src/app/page.tsx` (server component → `KaagazApp` with the catalog + samples), `src/app/layout.tsx` (Noto Sans Bengali for Assamese, viewport, Geist Mono dropped), `src/app/globals.css` (one light high-contrast theme, font stack, print background).
- `src/core/evaluate.ts`: `LOW_CONFIDENCE_THRESHOLD` moved to `thresholds.ts` and re-exported, so the client bundle doesn't pull in the engine.

**Results**
- `npm test`: 16 files, 150 passed, 0 failed (93 from T1 + 57 new).
- `npm run typecheck`: pass. `npm run lint`: pass. `npm run build`: pass (`/` static, `/api/check` + `/api/extract` dynamic).
- Smoke test on `next start`: home HTML has `lang="as"`, the Assamese title and the flagship badge. `/api/check` A → likely_eligible + ready_for_review (4 external checks to verify); B → action_required (`name_land_record` action_required, `name_bank_passbook` possible_match → verify); C → action_required (`doc_death_certificate`).
- Live AI check with the real key (fake "SAMPLE ONLY" Aadhaar image I drew locally): 200, `{ name: "Ramesh Kumar Sharma", dob: "1975-03-12", aadhaarLast4: "4821" }` from the printed "1234 5678 4821". Image input is accepted by the Cline API. With no key: 503 `ai_unavailable`, and the UI switches to manual entry.


**Design decisions / deviations (please review)**
- **No `export const runtime = "nodejs"` in the route files.** Next 16.4 fails the build with "Route segment config "runtime" is not compatible with `nextConfig.cacheComponents`". Node.js is the default (and the only runtime with cacheComponents), so the routes do run on Node. A comment in each route explains this. Rule 03-stack asks for the export, so please confirm.
- **The Cline API wraps the OpenAI body as `{ data: { choices } }`.** `ai.ts` accepts both shapes (tested). Before this fix, every live call fell back to `ai_failed`.
- **Environment gotcha:** this shell has an empty `CLINE_MODEL` environment variable. Next does not override an existing env var from `.env.local`, so the server saw no model and returned `ai_unavailable`. It works after `Remove-Item Env:CLINE_MODEL`. Added to techContext.
- **Minimum data:** nothing is read from the death certificate or BPL proof (the engine only checks that they are present), so `husbandName` is not collected. The cover sheet shows the masked Aadhaar and no account number.
- **Empty manual docs:** "Type it in" adds the document with empty fields. The engine then counts it as present, and its fields show as "please verify"/"could not read". I think this is right ("I have it, I'll type it"); flagging it in case you prefer the slot to count only once a field is filled.
- A sample replaces any documents and answers already entered and jumps to "Check what we read" (all sample fields are ≥ 0.8 confidence, so nothing is highlighted). The purple "Demo mode: fake sample documents (A)" label stays on every step and on the printed sheet.
- Unanswered questions are allowed; the engine marks them needs_verification (a note under the questions says so).

**Open issues**
- All new Assamese UI strings in `src/i18n.ts` are drafts and need native-speaker review (Das), like the T1 strings.
- I did not test the UI in a real phone browser here (no browser automation in this environment). The flow was checked through the built HTML and the APIs; a manual click-through on a phone is recommended before the demo.
- `tasks/NEXT.md` (Claude's T2 spec), `.cline-runs/index.md` and `run-134715-f3yl.log` were already modified before this run, not by me. They are committed as-is with `git add -A`, per the workflow; I did not edit them.

**Requests for Claude**
- Confirm dropping `export const runtime = "nodejs"` (see above), or say whether to turn off `cacheComponents` instead.
- Confirm that "Type it in" should mark a document as added before any field is filled.

