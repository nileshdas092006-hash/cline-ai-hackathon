# NEXT TASK: T0, Memory Bank + scaffold

Idea chosen: **KaagazCheck**, which checks welfare documents before you apply (see `memory-bank/projectbrief.md`, `docs/PS.md`, `docs/schemes.md`, `docs/research.md`).

Mode: PLAN first (a short plan we can show judges), then ACT.

1. Read `docs/PS.md`, `docs/schemes.md`, `docs/research.md` and `memory-bank/projectbrief.md`.
2. Create Memory Bank files, short and factual: `productContext.md`, `systemPatterns.md` (AI reads → rule engine decides → AI explains; one AI module; one DB writer), `techContext.md` (stack from .clinerules/03-stack.md), `activeContext.md`, `progress.md`.
3. `git init` if needed. Scaffold a Next.js App Router app (TypeScript strict, Tailwind) IN THIS FOLDER, keeping `memory-bank/`, `tasks/`, `docs/`, `.clinerules/`, `.cline-runs/`.
4. Add Vitest + fast-check, zod; npm scripts `test`, `build`, `lint`, `typecheck`.
5. `.gitignore`: `.env.local`, `node_modules`, `.next`, `*.db`, but NOT `.cline-runs/`. Add `.env.example` with `CLINE_API_KEY=` and `CLINE_MODEL=`.
6. A placeholder home page titled "KaagazCheck: कागज़ चेक" and one smoke test.

**Done when:** `npm test` and `npm run build` pass, the Memory Bank exists, the first commit is made ("T0: scaffold + memory bank"), LOG.md updated.

Next after this: `tasks/backlog/T1-core-engine.md`.
