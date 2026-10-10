// POST /api/check: { schemeId, schemeVersion?, docs, answers, asOfDate? } → Report (rule engine only).
// Runs on Node.js: the default, and the only runtime with cacheComponents. Next 16 rejects an explicit
// `export const runtime` when cacheComponents is on, so it is deliberately not exported here.
import { handleCheck } from "@/server/api";

export async function POST(req: Request): Promise<Response> {
  return handleCheck(req);
}
