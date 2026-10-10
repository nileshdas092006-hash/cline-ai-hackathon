# T2: Main flow end to end, API + UI (about 75 min)

Mode: ACT. Mobile-first; **Assamese default, English toggle**; all fixed strings in `src/i18n.ts` (`as`, `en`). Use a font that renders Assamese well (e.g. Noto Sans Bengali, which covers Assamese).

1. `src/server/ai.ts` (the ONLY model caller): `extractDocument(imageBase64, hintDocType?)` → `ExtractedDoc` (zod), per-field confidence, one retry, safe fallback `{ error }`. Cline API (OpenAI-compatible) with image input; if images are rejected, note it under "Requests for Claude" and keep manual entry working. Mask Aadhaar inside ai.ts. Never store images.
2. `src/core/samples.ts`: samples A/B/C as in memory-bank/projectbrief.md (fake names, `XXXX XXXX 0000`-style Aadhaar).
3. API (`runtime = "nodejs"`): `POST /api/extract`, `POST /api/check` (schemeId, docs, answers, asOfDate? → Report).
4. UI steps: scheme cards (Assamese names; PM-KISAN marked "flagship") → documents (photo per mandatory doc, or "Use sample A/B/C") → confirm fields (low confidence highlighted) → yes/no questions (big buttons) → **report with TWO verdict banners**: "Eligibility" and "Application readiness", each 🟢/🔴/🟡/⚪ → check list (reason, where to fix, source link with "verified on" date, a "provisional rule" badge where relevant) → "Print cover sheet".
5. Footer on every report: "We help catch preventable mistakes. We don't guarantee approval; the department decides." (Assamese + English).

**Done when:** sample A → readiness ready_for_review with bank seeding flagged needs verification; sample B → action_required naming the land record and the bank name variant; sample C → action_required (death certificate); with AI unavailable, manual entry completes the flow; API tests (mocked ai.ts) pass; build passes; committed "T2: main flow".
