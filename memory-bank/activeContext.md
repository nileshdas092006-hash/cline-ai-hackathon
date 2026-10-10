# Active context

## Current state
T0 (Memory Bank + scaffold) is done. The app is a placeholder home page titled "KaagazCheck: कागज़ चेक" with a smoke test.

## Decisions made in T0
- Next.js 16.4.0 scaffolded in a temp folder and copied in (create-next-app refuses non-empty folders).
- `src/` layout with `@/*` alias. Core logic lives in `src/core/`; the smoke test (`src/core/appInfo.test.ts`) also exercises zod and fast-check.
- Vitest runs in the Node environment on `src/**/*.test.ts`; no jsdom or React rendering tests yet.
- `.gitignore`: ignores `.env`, `.env*.local`, `node_modules`, `.next`, `*.db`; keeps `.env.example` and `.cline-runs/` tracked.
- `<html lang="hi">`; page title and description come from `src/core/appInfo.ts`.

## Next step
T1, core engine (`tasks/backlog/T1-core-engine.md`): schemas, name matcher, rule engine for the 3 schemes, tests first.
