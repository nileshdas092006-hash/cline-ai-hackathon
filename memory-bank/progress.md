# Progress

## Done
- [x] T0: Memory Bank, Next.js 16 scaffold (TS strict, Tailwind v4, ESLint), Vitest + fast-check + zod, npm scripts, `.gitignore`, `.env.example`, placeholder page, smoke test, first commit.
- [x] T1: core rule engine v2. Step 0 (memory bank refreshed for brief v2; title "KaagazCheck: কাগজ চেক", taglines EN/AS, `<html lang="as">`); zod types; 3 rule packs with provenance + versioned registry; name matcher (Devanagari + Assamese/Bengali transliteration, Jaro-Winkler); `ageOn`; `maskAadhaar`; `benefitOn` with overrides; `evaluate` with two verdicts; rejection codes EN/AS; samples A/B/C. 93 tests.

- [x] T2: main flow. `src/server/ai.ts` (Cline API vision, zod, one retry, `{ error }` fallback), `/api/extract` + `/api/check`, pure helpers (`extraction`, `flow`, `reportView`, `catalog`), `src/i18n.ts` (as/en), mobile UI (scheme → docs/samples → confirm → questions → two-verdict report → print cover sheet). 150 tests.

- [x] T3: "type it in" fix (doc counts only once its main field is filled) + Rule Maintenance Agent: `@cline/sdk` Agent with 5 zod tools, `node:sqlite` store (`rule_versions`, WAL, transactions), pure rule tests / diff / policy / merge patch, admin API (NDJSON stream, list, publish, reject), `/admin` UI (demo notices, live log, diff, tests, Publish/Reject, history), `scripts/agent-smoke.mjs`. Both demo notices verified live. 225 tests.

## To do
- [ ] T4: rejection decoder + polish
- [ ] T-last: freeze, full README, demo path check

## Known issues
- `npm install` warns that eslint@9 is deprecated (pinned by eslint-config-next 16.4.0). Harmless.
- Assamese strings (incl. all of `src/i18n.ts`) are drafts; they need native-speaker review before the demo.
- The T2 UI has not been clicked through on a real phone yet (only HTML + API smoke tests).
- Route files omit `export const runtime = "nodejs"` (incompatible with `cacheComponents` in Next 16.4); approved by Claude in T3.
- `/admin` has no authentication (anyone who can reach the server can run the agent and publish). Fine for the local demo; needs a decision before any deployment.
- The engine has one flat benefit amount per scheme, so IGNOAPS's ₹500/month for ages 80+ can only be a note (the agent said so itself). Age-banded benefits would need an engine change.
- A live agent run takes about 20–60 s; the UI streams each tool call so the wait is visible.
- `npm install` warns that `protobufjs` (a dependency of `@cline/sdk`) has an unapproved postinstall script. Harmless; nothing is broken.
- The transliteration table is basic (good enough for possible_match on common names; cross-script is never `same`).
