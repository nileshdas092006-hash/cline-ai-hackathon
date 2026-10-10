# T4: Rejection decoder, guardrails, polish (about 75 min)

Mode: ACT. Cut from the bottom if time is short.

1. **Guardrails audit (do first):** Aadhaar masked in UI, logs and print; no images stored; every AI output zod-validated; footer disclaimer on every report; provenance + "verified on" + provisional badge on every check; no check turns `ok` from a fuzzy score.
2. **Rejection decoder** (`/decode`): paste text or a photo of a rejection/status message → `ai.ts` `classifyRejection()` returns ONE code from `rejectionCodes.ts` + confidence; fix steps come from code (Assamese + English). UNKNOWN or low confidence → "needs verification" + what to ask at the office.
3. Draft a correction/grievance letter (AI, Assamese, labelled "draft, please check") on the print page.
4. Voice: 🔊 read the report aloud only if the browser has an Assamese (as-IN) voice; otherwise hide the button (don't fall back to a wrong language).
5. `npm run demo:reset`: clears proposals, restores v1 rule packs, seeds samples.
6. Polish: big tap targets, loading/empty/error states, works at 360px width.

**Done when:** "Payment failed: Aadhaar not seeded with bank account" → `AADHAAR_NOT_SEEDED_BANK` with Assamese fix steps; guardrails verified; tests + build pass; committed "T4: decoder, guardrails, polish".
