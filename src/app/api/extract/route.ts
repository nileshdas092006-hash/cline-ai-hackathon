// POST /api/extract: { image (data URL), docType? } → { doc, detectedDocType } or { error }.
// The image is read in memory by ai.ts and never stored.
// Runs on Node.js: the default, and the only runtime with cacheComponents. Next 16 rejects an explicit
// `export const runtime` when cacheComponents is on, so it is deliberately not exported here.
import { handleExtract } from "@/server/api";

export async function POST(req: Request): Promise<Response> {
  return handleExtract(req);
}
