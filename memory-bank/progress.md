# Progress

## Done
- [x] T0: Memory Bank, Next.js 16 scaffold (TS strict, Tailwind v4, ESLint), Vitest + fast-check + zod, npm scripts, `.gitignore`, `.env.example`, placeholder page, smoke test, first commit.
- [x] T1: core rule engine v2. Step 0 (memory bank refreshed for brief v2; title "KaagazCheck: কাগজ চেক", taglines EN/AS, `<html lang="as">`); zod types; 3 rule packs with provenance + versioned registry; name matcher (Devanagari + Assamese/Bengali transliteration, Jaro-Winkler); `ageOn`; `maskAadhaar`; `benefitOn` with overrides; `evaluate` with two verdicts; rejection codes EN/AS; samples A/B/C. 93 tests.

- [x] T2: main flow. `src/server/ai.ts` (Cline API vision, zod, one retry, `{ error }` fallback), `/api/extract` + `/api/check`, pure helpers (`extraction`, `flow`, `reportView`, `catalog`), `src/i18n.ts` (as/en), mobile UI (scheme → docs/samples → confirm → questions → two-verdict report → print cover sheet). 150 tests.

- [x] T3: "type it in" fix (doc counts only once its main field is filled) + Rule Maintenance Agent: `@cline/sdk` Agent with 5 zod tools, `node:sqlite` store (`rule_versions`, WAL, transactions), pure rule tests / diff / policy / merge patch, admin API (NDJSON stream, list, publish, reject), `/admin` UI (demo notices, live log, diff, tests, Publish/Reject, history), `scripts/agent-smoke.mjs`. Both demo notices verified live. 225 tests.

- [x] T4 (trimmed): optional admin passcode (`ADMIN_PASSCODE` → `x-admin-passcode` on `/api/admin/*`; passcode box / "Demo mode: unprotected" banner), guardrails audit (`src/guardrails.test.ts`; cover sheet now prints source + verified on), rejection decoder `/decode` (`classifyRejection` in ai.ts → pure `decodeResult`, ≥ 0.7 or needs verification + what to ask), `npm run demo:reset`, optional `AgeRange.max`. 264 tests.

- [x] T-last: agent prompt says `ageRange.max` may be left out (prompt `rule-agent-v2`, +1 test); full `README.md` (from `docs/README-draft.md`, every path/route/script checked; demo path; honest attribution); secret check clean; demo reset + test/typecheck/lint/build pass; tag `round2-final`. 265 tests.

## To do
- [ ] Demo path check on a real phone (incl. 360px click-through of `/`, `/admin`, `/decode`); not possible from this environment.
- [ ] Native-speaker review of the Assamese strings.

## Future scope
- Age-banded payments (e.g. IGNOAPS ₹200 for 60–79, ₹500 for 80+): the engine has one flat benefit per scheme; would need benefit bands keyed by age. Not now (Claude, T4).
- Decoder: photo of a rejection letter, and an AI-drafted correction/grievance letter (cut in T4).
- Assamese voice readout (only with a real as-IN voice).

## Known issues
- `npm install` warns that eslint@9 is deprecated (pinned by eslint-config-next 16.4.0). Harmless.
- Assamese strings (incl. all of `src/i18n.ts`) are drafts; they need native-speaker review before the demo.
- The T2 UI has not been clicked through on a real phone yet (only HTML + API smoke tests).
- Route files omit `export const runtime = "nodejs"` (incompatible with `cacheComponents` in Next 16.4); approved by Claude in T3.
- `/admin` is open unless `ADMIN_PASSCODE` is set in `.env.local` (then the API needs the passcode; the page shows a passcode box). Set it for any shared deployment.
- The engine has one flat benefit amount per scheme, so IGNOAPS's ₹500/month for ages 80+ can only be a note (see Future scope).
- The agent prompt's new "leave `ageRange.max` out" line (T-last) has not been tried against the live API yet.
- A live agent run takes about 20–60 s; the UI streams each tool call so the wait is visible.
- `npm install` warns that `protobufjs` (a dependency of `@cline/sdk`) has an unapproved postinstall script. Harmless; nothing is broken.
- The transliteration table is basic (good enough for possible_match on common names; cross-script is never `same`).
