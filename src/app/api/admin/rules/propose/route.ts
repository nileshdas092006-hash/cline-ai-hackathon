// POST /api/admin/rules/propose: { notice } → runs the Rule Maintenance Agent and streams its
// tool calls as NDJSON. The agent can only save a *proposed* version; a person publishes it.
// Runs on Node.js: the default, and the only runtime with cacheComponents. Next 16 rejects an explicit
// `export const runtime` when cacheComponents is on, so it is deliberately not exported here.
import { handlePropose } from "@/server/adminApi";

export async function POST(req: Request): Promise<Response> {
  return handlePropose(req);
}
