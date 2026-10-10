# Progress

## Done
- [x] T0: Memory Bank (productContext, systemPatterns, techContext, activeContext, progress), Next.js 16 scaffold (TS strict, Tailwind v4, ESLint), Vitest + fast-check + zod, npm scripts, `.gitignore`, `.env.example`, placeholder page, smoke test, first commit.

## To do
- [ ] T1: core engine (types/zod schemas, name matcher, rule engine, 3 schemes, sample sets)
- [ ] T2: main flow (scheme picker → documents → questions → readiness report, Hindi/English, AI gateway `src/server/ai.ts`)
- [ ] T3: Scheme Onboarding Agent (`@cline/sdk`, `node:sqlite` store, admin approval)
- [ ] T4: rejection decoder + polish
- [ ] T-last: freeze, full README, demo path check

## Known issues
- `npm install` warns that eslint@9 is deprecated (it is the version create-next-app 16.4.0 pins with eslint-config-next). Harmless for now.
