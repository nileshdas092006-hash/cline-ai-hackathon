// POST /api/decode: { text } → one known rejection code + fix steps (Assamese + English).
// The model only classifies; the steps and the "needs verification" decision are code (src/core/decode.ts).
// Runs on Node.js: the default, and the only runtime with cacheComponents. Next 16 rejects an explicit
// `export const runtime` when cacheComponents is on, so it is deliberately not exported here.
import { handleDecode } from "@/server/api";

export async function POST(req: Request): Promise<Response> {
  return handleDecode(req);
}
