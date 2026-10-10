// Request schemas and handlers for the API routes. The route files are thin wrappers.
// /api/check runs the deterministic engine only (no model). /api/extract goes through ai.ts.
import { z } from "zod";
import { MAX_DECODE_CHARS, decodeResult } from "@/core/decode";
import { evaluate } from "@/core/evaluate";
import { getScheme } from "@/core/schemes";
import { Answers, DocType, ExtractedDoc, IsoDate } from "@/core/types";
import { classifyRejection, extractDocument } from "@/server/ai";
import { getRuleService } from "@/server/rules";

/** Base64 of a ~6 MB image is ~8 MB; refuse anything bigger before parsing further. */
const MAX_BODY_CHARS = 9 * 1024 * 1024;

export const CheckRequest = z.object({
  schemeId: z.string().min(1).max(64),
  schemeVersion: z.string().max(32).optional(),
  docs: z.array(ExtractedDoc).max(20),
  answers: Answers,
  asOfDate: IsoDate.optional(),
});
export type CheckRequest = z.infer<typeof CheckRequest>;

export const ExtractRequest = z.object({
  image: z.string().min(1).max(MAX_BODY_CHARS),
  docType: DocType.optional(),
});

/** Today's date in India (Asia/Kolkata, UTC+5:30, no DST) as YYYY-MM-DD. */
export function todayInIndia(now: Date = new Date()): string {
  return new Date(now.getTime() + 330 * 60_000).toISOString().slice(0, 10);
}

const json = (body: unknown, status = 200) => Response.json(body, { status });

async function readJson(req: Request): Promise<{ ok: true; value: unknown } | { ok: false }> {
  try {
    const text = await req.text();
    if (text.length > MAX_BODY_CHARS) return { ok: false };
    return { ok: true, value: JSON.parse(text) };
  } catch {
    return { ok: false };
  }
}

/** Only paths and codes: never echo submitted values (they can hold personal data). */
function issues(error: z.ZodError) {
  return error.issues.slice(0, 10).map((i) => ({ path: i.path.join("."), code: i.code }));
}

export async function handleCheck(req: Request): Promise<Response> {
  const body = await readJson(req);
  if (!body.ok) return json({ error: "invalid_json" }, 400);
  const parsed = CheckRequest.safeParse(body.value);
  if (!parsed.success) return json({ error: "invalid_request", issues: issues(parsed.error) }, 400);

  const { schemeId, schemeVersion, docs, answers } = parsed.data;
  getRuleService().syncRegistry(); // published rule versions take effect at once
  const scheme = getScheme(schemeId, schemeVersion);
  if (!scheme) return json({ error: "unknown_scheme" }, 404);
  return json(evaluate(scheme, docs, answers, parsed.data.asOfDate ?? todayInIndia()));
}

const EXTRACT_STATUS = { ai_unavailable: 503, ai_failed: 502, invalid_image: 400 } as const;

export async function handleExtract(req: Request): Promise<Response> {
  const body = await readJson(req);
  if (!body.ok) return json({ error: "invalid_json" }, 400);
  const parsed = ExtractRequest.safeParse(body.value);
  if (!parsed.success) return json({ error: "invalid_request", issues: issues(parsed.error) }, 400);

  try {
    const result = await extractDocument(parsed.data.image, parsed.data.docType);
    if ("error" in result) return json({ error: result.error }, EXTRACT_STATUS[result.error]);
    return json(result);
  } catch {
    return json({ error: "ai_failed" }, 502);
  }
}

export const DecodeRequest = z.object({ text: z.string().trim().min(1).max(MAX_DECODE_CHARS) });

/**
 * POST /api/decode { text } → { result: DecodeResult, ai: "ok" | "ai_unavailable" | "ai_failed" }.
 * The model only proposes a code + confidence; decodeResult (pure code) decides what is shown.
 * Without an AI answer the citizen still gets "needs verification" + what to ask at the office.
 */
export async function handleDecode(req: Request): Promise<Response> {
  const body = await readJson(req);
  if (!body.ok) return json({ error: "invalid_json" }, 400);
  const parsed = DecodeRequest.safeParse(body.value);
  if (!parsed.success) return json({ error: "invalid_request", issues: issues(parsed.error) }, 400);

  try {
    const ai = await classifyRejection(parsed.data.text);
    if ("error" in ai) {
      if (ai.error === "invalid_text") return json({ error: "invalid_request" }, 400);
      return json({ result: decodeResult(null), ai: ai.error });
    }
    return json({ result: decodeResult(ai), ai: "ok" });
  } catch {
    return json({ result: decodeResult(null), ai: "ai_failed" });
  }
}
