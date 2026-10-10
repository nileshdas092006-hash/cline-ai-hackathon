# NEXT TASK: T4 (trimmed), guardrails, admin passcode, decoder, demo reset

Time box: about 60 minutes. Feature freeze at 18:45 IST. Keep changes small; don't refactor working code.

T3 reviewed: 225/225 tests and the build pass. Answers to your requests:
- The extra `notice` and `summary` columns: **approved**.
- Age-based payment bands: **not now**. Record them as "Future scope" in `memory-bank/progress.md`. Make the upper age limit **optional** in the schema only if it takes under 10 minutes; otherwise leave it.
- Admin protection: use a simple passcode (see 1).

## Do, in this order (stop and commit if time runs out)
1. **Admin passcode:** an optional env var `ADMIN_PASSCODE` (add it to `.env.example` with no value). If it's set, every `/api/admin/*` route requires the header `x-admin-passcode`, and `/admin` shows a passcode box (kept in sessionStorage). If it's not set, `/admin` shows a visible "Demo mode: unprotected" banner. Add tests.
2. **Guardrails audit**, with a test for each where possible: Aadhaar masked in UI, logs and print; no images stored; all AI output zod-validated; disclaimer footer on every report; provenance + "verified on" + provisional badge on every check; a fuzzy score never yields `ok`. Fix anything missing. Write the checklist and results into `tasks/LOG.md`.
3. **Rejection decoder** `/decode` (small): a textarea (paste a rejection/status message) → `ai.ts` `classifyRejection()` → ONE code from `rejectionCodes.ts` (zod enum) + confidence → fix steps from code (Assamese + English). `UNKNOWN` or confidence < 0.7 → "needs verification" + what to ask at the office. Mock the AI in tests. Link it from the home page ("Got a rejection? Decode it").
4. **`npm run demo:reset`:** clears `data/kaagaz.db` proposals and versions back to the built-in v1 rule packs. Make sure the home page then lists only the 3 original schemes.
5. Small polish only if time remains: 360px-width check, loading states.

Do NOT build: voice, letter drafting, photo upload on /decode.

**Done when:** 1–4 work; `npm test`, `npm run typecheck`, `npm run lint` and `npm run build` pass; LOG.md updated; committed "T4: guardrails, admin passcode, decoder, demo reset".
