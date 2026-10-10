// POST /api/admin/rules/:id/reject: a person rejects a proposed version (kept in the history).
// Runs on Node.js: the default, and the only runtime with cacheComponents. Next 16 rejects an explicit
// `export const runtime` when cacheComponents is on, so it is deliberately not exported here.
import { handleDecision } from "@/server/adminApi";

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await ctx.params;
  return handleDecision(id, "reject");
}
