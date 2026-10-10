# Tech context

## Stack
- One Next.js 16 app (App Router, `src/` dir, `@/*` → `./src/*`), React 19, TypeScript strict, Tailwind CSS v4 (via `@tailwindcss/turbopack` loader in `next.config.ts`).
- Validation: zod 4.
- Tests: Vitest 5 (Node environment, `src/**/*.test.ts`) + fast-check 4.
- Lint: ESLint 9 flat config (`eslint-config-next`); `next lint` no longer exists in Next 16.
- Database (T3, done): built-in `node:sqlite` (WAL, SQLite 3.53.4) in `src/server/store.ts`; no fallback needed.
- AI: Cline API (OpenAI-compatible), base URL `https://api.cline.bot/api/v1`, all calls via `src/server/ai.ts`.
- In-product agent (T3, done): `@cline/sdk@0.0.92` `Agent`, `providerId: "openai-compatible"`, tools via `createTool` with zod schemas (details below).

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

## Cline SDK (`@cline/sdk` 0.0.92), found in T3 by reading node_modules
- `@cline/sdk` is only `export * from "@cline/core"`. Core re-exports `Agent` (from `@cline/agents`, same class as `AgentRuntime`) and `createTool` (from `@cline/shared`). ESM-only, Node ≥ 22, depends on zod ^4.
- `new Agent({ providerId: "openai-compatible", baseUrl: "https://api.cline.bot/api/v1", apiKey, modelId, systemPrompt, tools, maxIterations, toolExecution })` → `agent.run(text)` returns `{ status: "completed"|"aborted"|"failed", outputText, iterations, usage, error? }`. `agent.subscribe(fn)` streams events: `tool-started` / `tool-finished` (`toolCall { toolCallId, toolName, input }`, `message.content[].output`), `assistant-text-delta` (`accumulatedText`), `run-failed`, etc. `agent.abort()` cancels.
- `createTool({ name, description, inputSchema: zodSchema, execute })` converts zod → JSON Schema (`additionalProperties: false`). It does **not** zod-validate the input before `execute` (verified: `{a: 5}` reached a `z.string()` tool), so each tool wraps `execute` in `checked(schema, fn)` → `safeParse` → `{ error }`. Default tool timeout 30 s, retryable, max 3 retries.
- The agent retries transient provider errors itself. A thrown `execute` error becomes an `isError` tool result the model sees.
- Matches .clinerules/03-stack.md; no differences in the API used.
- **Turbopack cannot bundle `@cline/core`** (dynamic `new URL("./entry."+ext, import.meta.url)` worker URLs → 72 "Module not found" errors). Fixed with `serverExternalPackages: ["@cline/sdk", "@cline/core", "@cline/agents", "@cline/llms", "@cline/shared"]` in `next.config.ts`.
- `ai.ts` imports `@cline/sdk` lazily (dynamic import) inside the real agent factory; `ruleMaintenance.ts` imports `createTool` statically (cold import ≈ 1.4 s, only on admin routes).
- Live timing with `anthropic/claude-sonnet-5.5`: Orunodoi notice ≈ 21 s (6 tool calls), IGNOAPS new scheme ≈ 30–60 s. Longer than the tool timeout here, so run `scripts/agent-smoke.mjs` in the background with a log.

## T3 storage
- `node:sqlite` works inside Next 16 route handlers and Vitest (no build trouble). DB file: `KAAGAZ_DB_PATH` or `data/kaagaz.db` (`/data/` is git-ignored). Vitest sets `KAAGAZ_DB_PATH=:memory:` (vitest.config.mts), so tests never touch `data/`.
- A page that reads the DB/registry per request needs `await connection()` inside a `<Suspense>` child (Cache Components). `connection()` throws outside a Next request scope, so unit tests call the handler (`handleList`) instead of the route.
- `cmd /c "x & echo %ERRORLEVEL%"` expands ERRORLEVEL too early (prints empty). Use `cmd /c "npm test >nul 2>&1"; $LASTEXITCODE` in PowerShell.

## Scaffold notes
Generated with `create-next-app@16.4.0` in a temp folder and copied in (it refuses non-empty folders). Defaults kept: `cacheComponents: true`, `partialPrefetching: true`. `AGENTS.md` is written by Next (`next dev` re-adds it), so it is committed.
