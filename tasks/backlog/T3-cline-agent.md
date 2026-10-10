# T3: Cline SDK agent inside the product: Rule Maintenance Agent (about 75 min)

Mode: PLAN first (short), then ACT. The bonus criterion; it must do a real, visible job.

1. `src/server/store.ts` (the only DB writer, `node:sqlite`): table `rule_versions` (schemeId, version, ruleJson, testsJson, testResultJson, status proposed|published|rejected, sourceNote, createdAt, approvedAt). On startup and on publish, load the latest published version of each scheme into the registry. Built-in schemes are version 1.
2. `src/server/agents/ruleMaintenance.ts`: `@cline/sdk` `Agent` (config in .clinerules/03-stack.md), tools via `createTool` with zod inputs:
   - `getRuleSchema()` → the SchemeRule JSON schema + examples.
   - `getCurrentRule(schemeId)` → the current published rule + its regression tests.
   - `proposeRule(rule)` → zod validation errors, or ok.
   - `runTests(rule, testCases[])` → runs the new cases AND all existing regression tests for that scheme through `evaluate`/`benefitOn`; returns pass/fail per case.
   - `saveProposal(rule, tests, sourceNote)` → stores status `proposed`.
   System prompt: read the notice; decide whether it's a new scheme or a change to an existing one; propose the smallest rule change with provenance (sourceUrl if given, clause, effectiveDate; status `provisional` unless an official URL is provided); write regression tests; iterate until valid and all tests pass; never invent criteria not in the text (unclear → `notes`).
3. API: `POST /api/admin/rules/propose` (notice text → run the agent, stream tool-call events), `GET /api/admin/rules`, `POST /api/admin/rules/:id/publish`, `POST /api/admin/rules/:id/reject`.
4. UI `/admin`: paste box → live agent log (each tool call) → **readable diff** (old vs new values) → test results ✓/✗ (new + regression) → Publish / Reject. Version history list per scheme.
5. Unit tests for the tools and store with a mocked agent (no network).

**Done when:** (a) `docs/sample-guideline-ignoaps.md` → a valid Old Age Pension scheme with ≥3 passing tests; publishing makes it selectable; (b) `docs/sample-notice-orunodoi-oct2026.md` → a new Orunodoi version with an October override, tests showing 1500 in Oct / 1250 in Nov, and all old Orunodoi tests still passing. Tests and build pass; committed "T3: Cline SDK rule maintenance agent".
