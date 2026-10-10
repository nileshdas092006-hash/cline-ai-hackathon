# T0 — Memory Bank + scaffold (first 30 minutes after the idea is chosen)

Mode: PLAN first (show it to judges), then ACT.

1. Read `docs/PS*` and `memory-bank/projectbrief.md` (written by Claude).
2. Create the Memory Bank files: productContext, systemPatterns, techContext, activeContext, progress (short and factual).
3. `git init` if needed. Scaffold a Next.js App Router app (TypeScript strict, Tailwind) IN THIS FOLDER, keeping `memory-bank/`, `tasks/`, `docs/`, `.clinerules/`, `.cline-runs/`.
4. Add Vitest + fast-check; npm scripts `test`, `build`, `lint`, `typecheck`.
5. `.gitignore`: `.env.local`, `node_modules`, `.next`, `*.db` — NOT `.cline-runs/`.
6. One smoke test; `npm test` and `npm run build` pass.

**Done when:** tests and build pass, Memory Bank exists, first commit made, LOG.md updated.
