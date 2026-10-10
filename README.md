# KaagazCheck (কাগজ চেক): Check before you apply

> We help citizens catch preventable welfare-application mistakes **before** they submit their papers. AI reads the documents; a tested rule engine checks them; and a Cline agent maintains the rules as official guidelines change.
>
> We reduce preventable errors. We do **not** guarantee approval; the department decides.

## The problem
Eligible people in India often lose welfare benefits *after* applying, because their documents disagree with each other (a name spelled differently on Aadhaar, the bank passbook and the land record; an account not linked to Aadhaar; a missing certificate), or because a rejection arrives with no reason they can understand.

- **Rajasthan, PM-KISAN (2019):** only about 23% of about 51 lakh registered farmers received the third instalment; officials cited names on applications not matching Aadhaar. ([Hindustan Times](https://www.pressreader.com/india/hindustan-times-st-jaipur/20191007/281586652343870))
- **Andhra Pradesh, PM-KISAN (LibTech India, 2022):** about 15.2 lakh farmers missed instalments and about ₹1,343 crore was pending; about half were held with "action required by the state" and no stated reason. ([LibTech report](https://libtech.in/wp-content/uploads/2022/01/‘PM-KISAN-Samman-Nidhi-AP-25th-January.pdf))

Finding schemes is already served (myScheme, Jugalbandi). **Getting an application through without a preventable rejection is not.** More evidence: `docs/research.md`.

## The solution
A mobile web app in **Assamese (default) with an English toggle**:
1. Pick a scheme: **PM-KISAN** (flagship), **Orunodoi 3.0** (Assam), **Widow Pension (IGNWPS)**.
2. Add documents: photo (AI reads them), type them in, or use the fake demo samples A, B or C.
3. Confirm anything the AI was unsure about (low-confidence fields are highlighted).
4. Answer a few yes/no questions.
5. Get **two separate verdicts**: *Eligibility* (likely eligible / not eligible / needs verification) and *Application readiness* (ready for review / action required / needs verification), each with what to fix, where to fix it (bank, Aadhaar centre, circle office, Gram Panchayat) and the source of every rule (verified or provisional).
6. Print a cover sheet to carry to the office.

Plus a **rejection decoder** (`/decode`): paste a rejection or payment-status message and get the likely reason and fix steps. The model only picks one known reason code; the steps are fixed text in code, and anything below 0.7 confidence is shown as "needs verification" with questions to ask at the office.

### 3-minute demo path
1. `npm run demo:reset`, then `npm run dev`.
2. `/` (Assamese by default; the English toggle is at the top) → PM-KISAN → **Use sample** B → the report shows *action required*: the land-record name is a mismatch and the bank name is only a possible match. Sample A is clean (*ready for review*, bank seeding still to verify); sample C (widow pension) is missing the death certificate.
3. `/admin` → **Load demo notice: Orunodoi October 2026** → **Propose rule change** → watch the tool calls, the diff and the tests (about 20–60 s) → **Publish 2.1.0**. A new Orunodoi report on `/` now shows ₹1,500 (reports use today's date; during October 2026), and `/api/check` with `"asOfDate": "2026-11-15"` still gives ₹1,250.
4. `/decode` → paste "Payment failed: Aadhaar not seeded with bank account".

## Cline inside the product: the Rule Maintenance Agent (`/admin`)
Government rules change. Paste a scheme notice and a **`@cline/sdk` agent**:
1. reads the current rule pack and the notice;
2. proposes the smallest rule change, with provenance (source, clause, effective date);
3. writes regression tests and runs them **together with every existing test** for that scheme;
4. shows a readable before/after diff and the test results;
5. waits for a **human to Publish**; then the citizen app uses the new version immediately, and old versions are kept.

The agent works only through five tools (`getRuleSchema`, `getCurrentRule`, `proposeRule`, `runTests`, `saveProposal`), defined in `src/server/agents/ruleMaintenance.ts`. **Code, not the prompt, enforces the safety rules** (`src/core/rulePolicy.ts`, `src/server/rules.ts`): the version must go up; at least 3 new tests with unique ids; a rule may be marked "verified" only if it was already verified with the same source or its source URL appears in the notice (otherwise it is "provisional", which the engine turns into "needs verification"); no save unless all tests pass; Publish re-runs every check.

Demo inputs: `docs/sample-guideline-ignoaps.md` (adds the Old Age Pension) and `docs/sample-notice-orunodoi-oct2026.md` (a one-time ₹1,500 payment for October 2026, with ₹1,250 still the regular amount).

Set `ADMIN_PASSCODE` in `.env.local` to protect `/api/admin/*` (header `x-admin-passcode`); without it, `/admin` shows a "Demo mode: unprotected" banner.

## Architecture
```
Phone browser ──► Next.js app (App Router)
                   ├─ / (citizen flow)     ├─ /decode       ├─ /admin (rule maintenance)
                   └─ API routes: /api/extract  /api/check  /api/decode  /api/admin/rules/*
                         │            │                         │
                 src/server/ai.ts   src/core/evaluate.ts   src/server/agents/ruleMaintenance.ts
                 (ONLY model caller; (pure, tested rule      (@cline/sdk Agent + 5 tools)
                  zod-validated JSON) engine: two verdicts,          │
                         │            provenance, name match)  src/server/store.ts
                 Cline API (OpenAI-                            (only DB writer, node:sqlite,
                 compatible, vision)                            versioned rule packs)
```
`/api/admin/rules/*` = `GET /api/admin/rules` (history), `POST /api/admin/rules/propose` (streams the agent's tool calls as NDJSON), `POST /api/admin/rules/[id]/publish`, `POST /api/admin/rules/[id]/reject`.

| Folder | What lives there |
|---|---|
| `src/core/` | Pure TypeScript: zod types, the three rule packs (`schemes/`), `evaluate.ts`, name matching, age, benefit, rule tests, rule diff, proposal policy, decoder logic. No network, database or `process.env`. |
| `src/server/` | `ai.ts` (the only module that calls a model: JSON output, zod check, one retry, safe fallback; logs model, prompt version and an input hash only), `store.ts` (the only database writer, every write in a transaction), `rules.ts` (validate → test → save → publish), `adminAuth.ts`, `agents/ruleMaintenance.ts`. |
| `src/app/` | The UI (`/`, `/decode`, `/admin`) and thin API route handlers. Fixed strings in `src/i18n.ts` (Assamese + English). |
| `scripts/` | `demo-reset.mjs` (`npm run demo:reset`), `smoke.mjs` and `agent-smoke.mjs` (manual live checks against a running server). |

**Trust design:** the AI reads and explains; **code decides**. Provisional rules and facts a photo can't prove (bank seeding, account active, eKYC, land verified) always return "needs verification". A fuzzy name score never counts as a match; only names identical after formatting clean-up do. Aadhaar is masked to the last 4 digits everywhere; images are processed in memory and never stored. Digits are redacted from rejection messages before the model sees them. These rules are checked by `src/guardrails.test.ts`.

## Tech stack
Next.js 16 (App Router, TypeScript strict, Tailwind v4) · zod · Vitest + fast-check (property tests) · `node:sqlite` · `@cline/sdk` · Cline API (OpenAI-compatible) for vision and language. Node 22+ (built and tested on Node 24).

## Setup
```powershell
npm install
copy .env.example .env.local  # then fill in CLINE_API_KEY and CLINE_MODEL (optional: ADMIN_PASSCODE, KAAGAZ_DB_PATH)
npm run dev                   # http://localhost:3000  ·  /admin  ·  /decode
npm test                      # unit + property tests (265)
npm run demo:reset            # restore the original 3 rule packs before a demo (clears published/proposed versions)
```
(On macOS/Linux use `cp` instead of `copy`.) Other scripts: `npm run typecheck`, `npm run lint`, `npm run build`, `npm start`.

`CLINE_MODEL` is a Cline API model id such as `anthropic/claude-sonnet-5.5`. Without a key the app still works: documents are typed in by hand, the decoder answers "needs verification", and the agent says it is not configured.

Windows note: if documents can't be read automatically ("Automatic reading is not available right now") although `.env.local` is filled in, run `Remove-Item Env:CLINE_MODEL` in that terminal (an empty shell variable overrides the file).

## How we used Cline
**Workflow:** Claude (in Claude Desktop) acted as architect and reviewer; **Cline wrote the code**. Claude wrote specs only (`docs/`, `memory-bank/projectbrief.md`, `tasks/`); Cline built every task through a local bridge that runs the official Cline CLI, and every run is logged in `.cline-runs/` (instructions in `run-*.task.md`, the full event log in `run-*.log`, an overview in `.cline-runs/index.md`). Cline's own report for each task is in `tasks/LOG.md`.

| Task | Cline run | What Cline built |
|---|---|---|
| T0 plan | `run-133031-4cma` (Plan mode) | Setup plan with Windows risks (path with a space, Devanagari encoding) |
| T0 | `run-133358-c1ef` | Next.js scaffold, Vitest, Memory Bank, first commit |
| T1 | `run-134715-f3yl` | Rule engine v2 with tests first: name matching, two verdicts, provenance (93 tests) |
| T2 | `run-144641-b8cr` | Assamese mobile flow, AI document reader, API routes (150 tests) |
| T3 | `run-152706-g9km` | `@cline/sdk` Rule Maintenance Agent, versioned store, /admin (225 tests) |
| T4 | `run-165739-gi16` | Admin passcode, guardrails audit (`src/guardrails.test.ts`, 14 tests), rejection decoder, `npm run demo:reset` (264 tests) |
| T-last | `run-173124-rw4j` | Agent prompt: the upper age limit may be left out; this README; secret check; final checks and the `round2-final` tag (265 tests) |

**Cline features used:** Plan/Act modes · `.clinerules/` (quality, workflow, stack rules) · Memory Bank (`memory-bank/`) · task specs (`tasks/NEXT.md`, `tasks/backlog/`) · the run log in `tasks/LOG.md` · the Cline CLI driven headlessly · **`@cline/sdk` inside the product**.

**Honest attribution:** all application code (everything in `src/`, `scripts/` and the config files) was written by Cline. Claude wrote the specs and task files and reviewed every task. Nilesh Das drove the product decisions and reviewed the rule packs against government sources; product research, the problem framing and the rule-pack research were done by Nilesh Das with Claude, and corrections to the rule packs came from Nilesh Das's review. `docs/README-draft.md` was not written by Cline; Cline adapted this README from it and checked every command, route and file name against the code.

## Limitations and future scope
- Rule packs cover 3 schemes; Orunodoi 3.0 exclusions are provisional until a current official guideline is confirmed.
- Payment bands by age (e.g. ₹500 at 80+ for old age pension) aren't modelled yet.
- Assamese text needs a native-speaker review; voice output is future work.
- The UI has been checked through server-rendered HTML and the APIs, not yet clicked through on a real phone at 360 px.
- `/admin` is open unless `ADMIN_PASSCODE` is set; set it for any shared deployment.
- Next: helper mode for CSC/NGO workers handling many applicants, an official status lookup where APIs exist, more states and languages.

