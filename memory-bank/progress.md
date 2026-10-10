# Progress

## Done
- [x] T0: Memory Bank, Next.js 16 scaffold (TS strict, Tailwind v4, ESLint), Vitest + fast-check + zod, npm scripts, `.gitignore`, `.env.example`, placeholder page, smoke test, first commit.
- [x] T1: core rule engine v2. Step 0 (memory bank refreshed for brief v2; title "KaagazCheck: কাগজ চেক", taglines EN/AS, `<html lang="as">`); zod types; 3 rule packs with provenance + versioned registry; name matcher (Devanagari + Assamese/Bengali transliteration, Jaro-Winkler); `ageOn`; `maskAadhaar`; `benefitOn` with overrides; `evaluate` with two verdicts; rejection codes EN/AS; samples A/B/C. 93 tests.

- [x] T2: main flow. `src/server/ai.ts` (Cline API vision, zod, one retry, `{ error }` fallback), `/api/extract` + `/api/check`, pure helpers (`extraction`, `flow`, `reportView`, `catalog`), `src/i18n.ts` (as/en), mobile UI (scheme → docs/samples → confirm → questions → two-verdict report → print cover sheet). 150 tests.

## To do
- [ ] T3: Rule Maintenance Agent (`@cline/sdk`, `node:sqlite` `rule_versions`, tests + human approval, versioned packs)
- [ ] T4: rejection decoder + polish
- [ ] T-last: freeze, full README, demo path check

## Known issues
- `npm install` warns that eslint@9 is deprecated (pinned by eslint-config-next 16.4.0). Harmless.
- Assamese strings (incl. all of `src/i18n.ts`) are drafts; they need native-speaker review before the demo.
- The T2 UI has not been clicked through on a real phone yet (only HTML + API smoke tests).
- Route files omit `export const runtime = "nodejs"` (incompatible with `cacheComponents` in Next 16.4); awaiting Claude's confirmation.
- The transliteration table is basic (good enough for possible_match on common names; cross-script is never `same`).
