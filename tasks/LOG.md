# Build log (Cline appends after every task)

## T0: scaffold + memory bank (run-133358-c1ef, 2026-10-10)
Followed the plan from run-133031-4cma.

**Files created/changed**
- Memory Bank: `memory-bank/productContext.md`, `systemPatterns.md`, `techContext.md`, `activeContext.md`, `progress.md` (`projectbrief.md` untouched).
- Scaffold (create-next-app@16.4.0 in a temp folder, copied in): `package.json`, `package-lock.json`, `tsconfig.json` (strict), `next.config.ts`, `eslint.config.mjs` (+ ignores for `.cline-runs/`, `docs/`, `memory-bank/`, `tasks/`), `next-env.d.ts`, `AGENTS.md`, `public/*`, `src/app/{layout.tsx,page.tsx,globals.css,favicon.ico}`.
- New: `src/core/appInfo.ts` (title/taglines, pure), `src/core/appInfo.test.ts` (smoke test, also exercises zod + fast-check), `vitest.config.mts`, `.env.example` (`CLINE_API_KEY=`, `CLINE_MODEL=`), `README.md` (short placeholder), `.gitignore` (ignores `.env`, `.env*.local`, `node_modules`, `.next`, `*.db*`; keeps `.env.example` and `.cline-runs/`).
- Deps added: `zod@^4.6.5`, dev `vitest@^5.0.3`, `fast-check@^4.10.2`, `@types/node@^22`.
- Scripts: `dev`, `build`, `start`, `lint` (`eslint .`), `typecheck` (`tsc --noEmit`), `test` (`vitest run`), `test:watch`.

**Results**
- `npm test`: 1 file, 3 passed, 0 failed.
- `npm run typecheck`: pass. `npm run lint`: pass (0 problems). `npm run build`: pass (Next 16.4.0, Turbopack; `/` prerendered static).
- Verified the built HTML contains "KaagazCheck: कागज़ चेक" and `lang="hi"`, and the CSS contains the Tailwind utilities used.

**Deviations from the plan**
- `@types/node` bumped from `^20` to `^22` (Vitest 5 peer requirement; matches Node 22+).
- Vitest config is `.mts` instead of `.ts` (avoids a Vite ESM/CJS config warning).
- `layout.tsx` uses explicit `Readonly<{ children: React.ReactNode }>` instead of the generated global `LayoutProps<"/">`, so `typecheck` passes before `.next/types` exists.
- No `postcss.config.mjs`: create-next-app 16.4 wires Tailwind v4 via the `@tailwindcss/turbopack` loader in `next.config.ts`; Tailwind confirmed working in the build.

**Open issues**
- npm warns `eslint@9` is deprecated (pinned by eslint-config-next 16.4.0) and that `unrs-resolver` has an unapproved postinstall script; neither blocks lint or build.
- `docs/sample-notice-orunodoi-oct2026.md` appeared in `docs/` during this run (not created by Cline); committed as-is with `git add -A`.

**Requests for Claude**
- None blocking. Please confirm that `docs/sample-notice-orunodoi-oct2026.md` is intended for T4 (rejection decoder) and reference it in the task spec if so.
