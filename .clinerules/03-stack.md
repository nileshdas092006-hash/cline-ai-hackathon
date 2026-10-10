# Default stack (use unless tasks/NEXT.md or memory-bank says otherwise)

- One Next.js app (App Router, TypeScript strict, Tailwind). No monorepo.
- `src/core/` pure TypeScript logic · `src/server/` store, AI gateway, agents · `app/api/**` routes with `export const runtime = "nodejs"`.
- Database: built-in `node:sqlite` (WAL mode); fall back to `better-sqlite3` if unavailable.
- Tests: Vitest (+ fast-check for property tests). npm scripts: `test`, `build`, `lint`, `typecheck`.
- AI models via the Cline API (OpenAI-compatible): base URL `https://api.cline.bot/api/v1`, key `CLINE_API_KEY`, model `CLINE_MODEL` (e.g. `anthropic/claude-sonnet-5.5` — dots, not dashes; never a `:batch` model) in `.env.local`.
- In-product agent (bonus criterion): `@cline/sdk` `Agent` with `providerId: "openai-compatible"`, `baseUrl: "https://api.cline.bot/api/v1"`, `apiKey: process.env.CLINE_API_KEY`, `modelId: process.env.CLINE_MODEL`, tools made with `createTool` (zod input schemas). Node 22+.
- UI: clean, fast, accessible, mobile-friendly; a clear 3-minute demo path matters more than many screens.
