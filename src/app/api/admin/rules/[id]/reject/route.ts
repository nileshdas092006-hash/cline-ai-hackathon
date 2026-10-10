// POST /api/admin/rules/:id/reject: a person rejects a proposed version (kept in the history).
// Runs on Node.js: the default, and the only runtime with cacheComponents. Next 16 rejects an explicit
// `export const runtime` when cacheComponents is on, so it is deliberately not exported here.
import { handleDecision } from "@/server/adminApi";
import { adminGuard } from "@/server/adminAuth";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  const denied = adminGuard(req);
  if (denied) return denied;
  const { id } = await ctx.params;
  return handleDecision(id, "reject");
}
