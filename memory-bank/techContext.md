# Tech context

## Stack
- One Next.js 16 app (App Router, `src/` dir, `@/*` → `./src/*`), React 19, TypeScript strict, Tailwind CSS v4 (via `@tailwindcss/turbopack` loader in `next.config.ts`).
- Validation: zod 4.
- Tests: Vitest 5 (Node environment, `src/**/*.test.ts`) + fast-check 4.
- Lint: ESLint 9 flat config (`eslint-config-next`); `next lint` no longer exists in Next 16.
- Database (T3): built-in `node:sqlite` (WAL); fall back to `better-sqlite3` only if needed. `node:sqlite` loads on this machine.
- AI: Cline API (OpenAI-compatible), base URL `https://api.cline.bot/api/v1`, all calls via `src/server/ai.ts`.
- In-product agent (T3): `@cline/sdk` `Agent`, `providerId: "openai-compatible"`, tools via `createTool` with zod schemas.

## Environment
- Windows, PowerShell 5.1; the path contains a space (`C:\Dev\cline hackathon\build`). Use npm scripts and cross-platform Node code.
- Node v24.21.0, npm 11.19.0, git 2.55.0.
- Secrets only in `.env.local` (git-ignored): `CLINE_API_KEY`, `CLINE_MODEL` (e.g. `anthropic/claude-sonnet-5.5`, never a `:batch` model). The template is `.env.example`.
- Write files containing Assamese (or other non-Latin text) with the editor tool (UTF-8), not PowerShell redirection. Assamese uses ৰ (U+09F0) and ৱ (U+09F1), not Bengali র/ব.
- The editor tool rejects payloads over ~6000 characters: write large files in chunks (create, then insert at the end).
- `tsconfig.json` includes `**/*.ts`, so never leave scratch `.ts` files in the repo root while running `next build`.

## npm scripts
| Script | Command |
|---|---|
| `dev` | `next dev` |
| `build` | `next build` |
| `start` | `next start` |
| `lint` | `eslint .` |
| `typecheck` | `tsc --noEmit` |
| `test` | `vitest run` |
| `test:watch` | `vitest` |

## Gotchas found in T0
- Vitest 5 needs `@types/node` ≥ 22 (peer dep), so `@types/node` is `^22`.
- The Vitest config is `vitest.config.mts` (ESM); a `.ts` config triggers a Vite "configLoader native" warning because `package.json` has no `"type": "module"`.
- The global `LayoutProps<"/">` type only exists after `next build`/`next dev` generate `.next/types`, so `layout.tsx` uses an explicit `Readonly<{ children: React.ReactNode }>` to keep `npm run typecheck` working on a clean checkout.
- Vite writes warnings to stderr, which PowerShell reports as `NativeCommandError`. Check the real exit code (e.g. run via `cmd /c ... & echo %ERRORLEVEL%`).
- `npm install` is slow here (about 5 minutes for a fresh install); long commands can exceed the tool timeout, so run them in the background with logs.

## Gotchas found in T2
- Next 16.4 + `cacheComponents: true` **rejects `export const runtime = "nodejs"`** in route files (build error). Node.js is the default runtime, so routes omit it.
- The Cline API (`/chat/completions`) returns the OpenAI body wrapped as `{ data: { choices: [...] } }`. Image input (`image_url` data URL) works with `anthropic/claude-sonnet-5.5`.
- This PowerShell session had an **empty `CLINE_MODEL` env var** set. Next never overrides an existing env var from `.env.local`, so the AI looked unconfigured. Run `Remove-Item Env:CLINE_MODEL` before `next dev`/`next start` if `/api/extract` says `ai_unavailable` while `.env.local` is filled.
- In Vitest, `beforeEach(() => mock.mockReset())` returns the mock, which Vitest then runs as a teardown. Use a block body `beforeEach(() => { mock.mockReset(); })`.
- Manual smoke test: `npm run build`, `npx next start -p 3123`, `node scripts/smoke.mjs http://localhost:3123`.

## Scaffold notes
Generated with `create-next-app@16.4.0` in a temp folder and copied in (it refuses non-empty folders). Defaults kept: `cacheComponents: true`, `partialPrefetching: true`. `AGENTS.md` is written by Next (`next dev` re-adds it), so it is committed.
