# NEXT TASK: T2, main flow end to end (API + UI)

T1 reviewed: 93/93 tests pass and typecheck is clean. Answers to your requests:
1. External checks are needs_verification but don't block ready_for_review on their own: **approved** (show them as a visible "check at the bank" list under the readiness banner).
2. Land in a spouse's or minor child's name → owner-name mismatch becomes needs_verification: **approved**.
3. Orunodoi any-of list and the widow BPL-proof document stay provisional: **approved**.

Note: `.env.local` does NOT exist yet (Das will add `CLINE_API_KEY` and `CLINE_MODEL`). So:
- `ai.ts` must handle a missing key gracefully: return `{ error: "ai_unavailable" }` and the UI falls back to manual entry. No crash, and no build failure.
- Tests mock `ai.ts`; no network in tests.

Do `tasks/backlog/T2-main-flow.md`. Adjustments:
- `src/core/samples.ts` already exists from T1; reuse it, don't duplicate.
- Default language Assamese, English toggle; keep all fixed strings in `src/i18n.ts` (reuse `src/core/labels.ts` where it fits).
- The report screen shows: the Eligibility banner, the Readiness banner, then "Fix before you apply" (action_required), then "Please verify" (needs_verification, including external checks), then "OK" (collapsed). Each item shows where to fix it, a source link and "verified on" date, and a "provisional rule" badge where relevant. Benefit amount: central share and state top-up shown separately ("state top-up: confirm locally" when null).
- Add a clear "Demo mode: fake sample documents" label when a sample is used.

**Done when:** everything in T2's "Done when" holds; `npm test`, `npm run typecheck`, `npm run lint` and `npm run build` all pass; LOG.md updated; committed "T2: main flow".
