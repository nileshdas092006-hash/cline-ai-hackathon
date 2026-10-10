// GET /api/admin/rules: every scheme with its live version and version history (diff + test results).
// Runs on Node.js: the default, and the only runtime with cacheComponents. Next 16 rejects an explicit
// `export const runtime` when cacheComponents is on, so it is deliberately not exported here.
import { connection } from "next/server";
import { handleList } from "@/server/adminApi";
import { adminGuard } from "@/server/adminAuth";

export async function GET(req: Request): Promise<Response> {
  await connection(); // always at request time: the history changes when someone publishes
  return adminGuard(req) ?? handleList();
}
