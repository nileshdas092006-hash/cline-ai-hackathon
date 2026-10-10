# NEXT TASK: T3, Cline SDK Rule Maintenance Agent (the bonus criterion)

T2 reviewed: 150/150 tests and the build pass. Answers to your requests:
- Leaving out `export const runtime` (because of cacheComponents): **approved**. Keep the comment in each route.
- "Type it in": a document counts as added **only once its name field (or the main field for that doc type) has a value**.
  Fix this first (small) with a test.

Then do `tasks/backlog/T3-cline-agent.md` (PLAN briefly at the top of your log entry, then ACT). Notes:
- `.env.local` now has `CLINE_API_KEY` and `CLINE_MODEL`. Install `@cline/sdk` (Node 22+ is available). If its API differs from .clinerules/03-stack.md, read the package's own README/types in node_modules and follow them; record what you found in `memory-bank/techContext.md`.
- The agent must work through **tools only** (`getRuleSchema`, `getCurrentRule`, `proposeRule`, `runTests`, `saveProposal`): it proposes data validated by zod, never writes source files.
- Keep tests offline: mock the agent; unit-test the tools and store directly.
- Admin page `/admin`: paste box with two "Load demo notice" buttons (the two files in docs/), a live tool-call log, a readable before/after diff, test results (new + regression), and Publish / Reject. Version history per scheme. Published versions take effect in the citizen flow immediately.
- If `node:sqlite` causes build trouble, a JSON file store under `data/` (gitignored) is acceptable, with the same one-writer rule.
- Put a manual live check in `scripts/agent-smoke.mjs` that runs both demo notices against the real API and prints the results.

**Done when:** T3's "Done when" holds (both demo notices produce passing, publishable proposals; existing regression tests still pass), all checks pass, LOG.md updated, committed "T3: Cline SDK rule maintenance agent".
