# KaagazCheck (কাগজ চেক): Check before you apply

> We help citizens catch preventable welfare-application mistakes **before** they submit their papers. AI reads the documents; a tested rule engine checks them; and a Cline agent maintains the rules as official guidelines change.
>
> We reduce preventable errors. We do **not** guarantee approval; the department decides.

## The problem
Eligible people in India often lose welfare benefits *after* applying, because their documents disagree with each other (a name spelled differently on Aadhaar, the bank passbook and the land record; an account not linked to Aadhaar; a missing certificate), or because a rejection arrives with no reason they can understand.

- **Rajasthan, PM-KISAN (2019):** only about 23% of about 51 lakh registered farmers received the third instalment; officials cited names on applications not matching Aadhaar. ([Hindustan Times](https://www.pressreader.com/india/hindustan-times-st-jaipur/20191007/281586652343870))
- **Andhra Pradesh, PM-KISAN (LibTech India, 2022):** about 15.2 lakh farmers missed instalments and about ₹1,343 crore was pending; about half were held with "action required by the state" and no stated reason. ([LibTech report](https://libtech.in/wp-content/uploads/2022/01/‘PM-KISAN-Samman-Nidhi-AP-25th-January.pdf))

Finding schemes is already served (myScheme, Jugalbandi). **Getting an application through without a preventable rejection is not.**

## The solution
A mobile web app in **Assamese (with English)**:
1. Pick a scheme: **PM-KISAN** (flagship), **Orunodoi 3.0** (Assam), **Widow Pension (IGNWPS)**.
2. Add documents: photo (AI reads them), type them in, or use fake demo samples.
3. Confirm anything the AI was unsure about.
4. Answer a few yes/no questions.
5. Get **two separate verdicts**: *Eligibility* (likely eligible / not eligible / needs verification) and *Application readiness* (ready for review / action required / needs verification), each with what to fix, where to fix it (bank, Aadhaar centre, circle office, Gram Panchayat) and the official source of every rule.
6. Print a cover sheet to carry to the office.

Plus a **rejection decoder** (`/decode`): paste a rejection or status message and get the likely reason and fix steps.

## Cline inside the product: the Rule Maintenance Agent (`/admin`)
Government rules change. Paste a scheme notice and a **`@cline/sdk` agent**:
1. reads the current rule pack and the notice;
2. proposes the smallest rule change, with provenance (source, clause, effective date);
3. writes regression tests and runs them **together with every existing test** for that scheme;
4. shows a readable before/after diff and the test results;
5. waits for a **human to Publish**; then the citizen app uses the new version immediately, and old versions are kept.

The agent works only through five tools (`getRuleSchema`, `getCurrentRule`, `proposeRule`, `runTests`, `saveProposal`). **Code, not the prompt, enforces the safety rules:** the version must go up; at least 3 new tests; nothing marked "verified" without an official source; no save unless all tests pass; Publish re-runs every check.

Demo inputs: `docs/sample-guideline-ignoaps.md` (adds the Old Age Pension) and `docs/sample-notice-orunodoi-oct2026.md` (a one-time ₹1,500 payment for October 2026, with ₹1,250 still the regular amount).

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
**Trust design:** the AI reads and explains; **code decides**. Provisional rules and facts a photo can't prove (bank seeding, account active, eKYC, land verified) always return "needs verification". A fuzzy name score never counts as a match; only names identical after formatting clean-up do. Aadhaar is masked to the last 4 digits everywhere; images are processed in memory and never stored.

## Tech stack
Next.js 16 (App Router, TypeScript strict, Tailwind v4) · zod · Vitest + fast-check (property tests) · `node:sqlite` · `@cline/sdk` · Cline API (OpenAI-compatible) for vision and language.

## Setup
```bash
npm install
cp .env.example .env.local    # then fill in CLINE_API_KEY and CLINE_MODEL (optional: ADMIN_PASSCODE)
npm run dev                   # http://localhost:3000  ·  /admin  ·  /decode
npm test                      # unit + property tests
npm run demo:reset            # restore the original 3 rule packs before a demo
```
Windows note: if the app says "AI unavailable" although `.env.local` is filled in, run `Remove-Item Env:CLINE_MODEL` in that terminal (an empty shell variable overrides the file).

## How we used Cline
**Workflow:** Claude (in Claude Desktop) acted as architect and reviewer; **Cline wrote the code**. Claude wrote specs only (`docs/`, `memory-bank/projectbrief.md`, `tasks/`); Cline built every task through a local bridge that runs the official Cline CLI, and every run is logged in `.cline-runs/`.

| Task | Cline run | What Cline built |
|---|---|---|
| T0 plan | `run-133031-4cma` (Plan mode) | Setup plan with Windows risks (path with a space, Devanagari encoding) |
| T0 | `run-133358-c1ef` | Next.js scaffold, Vitest, Memory Bank, first commit |
| T1 | `run-134715-f3yl` | Rule engine v2 with tests first: name matching, two verdicts, provenance (93 tests) |
| T2 | `run-144641-b8cr` | Assamese mobile flow, AI document reader, API routes (150 tests) |
| T3 | `run-152706-g9km` | `@cline/sdk` Rule Maintenance Agent, versioned store, /admin (225 tests) |
| T4 | *(fill in)* | Admin passcode, guardrails audit, rejection decoder, demo reset |

**Cline features used:** Plan/Act modes · `.clinerules/` (quality, workflow, stack rules) · Memory Bank (`memory-bank/`) · task specs (`tasks/NEXT.md`, `tasks/backlog/`) · the run log in `tasks/LOG.md` · the Cline CLI driven headlessly · **`@cline/sdk` inside the product**.

**Honest attribution:** product research, the problem framing and the rule-pack research were done by Das with Claude; corrections to the rule packs came from Das's review against government sources. *(If any code was written outside Cline, list it here.)*

## Limitations and future scope
- Rule packs cover 3 schemes; Orunodoi 3.0 exclusions are provisional until a current official guideline is confirmed.
- Payment bands by age (e.g. ₹500 at 80+ for old age pension) aren't modelled yet.
- Assamese text needs a native-speaker review; voice output is future work.
- Next: helper mode for CSC/NGO workers handling many applicants, an official status lookup where APIs exist, more states and languages.
