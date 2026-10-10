# Quality rules (always)

1. Tests first for core logic: write a failing test, then the code. Keep core logic in pure modules (no UI, network or database imports) so it is easy to test.
2. Anything that decides an outcome (scores, pass/fail, money, permissions) is computed by code, never taken from raw model text.
3. Every AI/model call goes through ONE module (`src/server/ai.ts`): structured JSON output, schema validation (zod), one retry, then a safe fallback. Log model, prompt version and an input hash.
4. One writer per piece of state: only the store module touches the database, and only inside transactions.
5. Secrets live only in `.env.local` (never committed, never printed, never sent to the browser).
6. Collect the minimum personal data; never collect camera, location, keystroke or emotion data unless the problem statement requires it.
7. Keep the app runnable at every commit: `npm test` and `npm run build` pass before you finish a task.
