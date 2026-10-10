# System patterns

## Core pipeline: AI reads → rule engine decides → AI explains
1. **Read (AI):** a document image or text → `ExtractedDoc` (fields + per-field confidence), validated with zod.
2. **Decide (pure code):** `src/core/` rule engine takes `SchemeRule` + `ExtractedDoc[]` + `Answers` → `ReadinessReport`. Deterministic, unit- and property-tested. No model text ever decides a status.
3. **Explain (AI, optional):** friendlier wording or a letter draft, built only from the report's codes and fields.

## Module boundaries
- `src/core/`: pure TypeScript (name matching, rule engine, schemas, scheme definitions). No React, network, DB or `process.env` imports.
- `src/server/ai.ts`: the **only** module that calls a model. Structured JSON output → zod validation → one retry → safe fallback. Logs the model, prompt version and an input hash (never raw personal data).
- `src/server/store.ts`: the **only** database writer (`node:sqlite`, WAL mode, transactions). Used from T3 for `scheme_proposals`.
- `src/server/agent/`: `@cline/sdk` Scheme Onboarding Agent (T3); its tools call into `src/core`.
- `src/app/api/**/route.ts`: thin route handlers with `export const runtime = "nodejs"`.
- `src/app/**`: UI. Calls API routes, never the model directly.

## Status vocabulary
- Check: `pass | fail | uncertain`.
- Report: `ready | fix_first | not_eligible | confirm_at_office`.
- Unclear rule or data → `uncertain` / `confirm_at_office`.

## Name matching (showcase)
Normalise (uppercase, strip punctuation, collapse spaces, drop honorifics) → expand abbreviations → Devanagari→Latin → Jaro-Winkler. Pass ≥ 0.92, uncertain 0.80–0.92, fail < 0.80. Initials never pass. See `docs/schemes.md`.

## Privacy
Aadhaar masked to the last 4 digits in UI, logs and printouts. Images are processed in memory only. Collect the minimum personal data.

## Testing
Vitest; fast-check property tests for the matcher and engine. Write tests first for core logic.
