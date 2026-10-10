// The ONLY module that calls a model (Cline API, OpenAI-compatible).
// Structured JSON → zod → one retry → safe fallback `{ error }`. Never throws to the caller.
// Logs model, prompt version and an input hash; never the image, the extracted text or any secret.
// Images are processed in memory only and never stored.
import { createHash } from "node:crypto";
import { RawExtraction, toExtractedDoc } from "@/core/extraction";
import { DocType as DocTypeSchema, type DocType, type ExtractedDoc } from "@/core/types";

export const DEFAULT_BASE_URL = "https://api.cline.bot/api/v1";
export const EXTRACT_PROMPT_VERSION = "extract-doc-v1";
/** Decoded image size limit (the browser downsizes photos well below this). */
export const MAX_IMAGE_BYTES = 6 * 1024 * 1024;
const DEFAULT_TIMEOUT_MS = 45_000;

export type AiError = "ai_unavailable" | "ai_failed" | "invalid_image";
export type ExtractResult = { doc: ExtractedDoc; detectedDocType: DocType | null } | { error: AiError };

export interface AiLogEntry {
  fn: "extractDocument" | "runToolAgent";
  model: string | null;
  promptVersion: string;
  inputHash: string | null;
  attempt: number;
  outcome: "ok" | "unavailable" | "invalid_image" | "http_error" | "bad_output" | "network_error" | "run_failed";
  status?: number;
  ms?: number;
  toolCalls?: number;
}

export interface AiDeps {
  fetch?: typeof fetch;
  env?: Record<string, string | undefined>;
  log?: (entry: AiLogEntry) => void;
  timeoutMs?: number;
}

interface AiConfig {
  apiKey: string;
  model: string;
  baseUrl: string;
}

function configFrom(env: Record<string, string | undefined>): AiConfig | null {
  const apiKey = env.CLINE_API_KEY?.trim();
  const model = env.CLINE_MODEL?.trim();
  if (!apiKey || !model) return null;
  return { apiKey, model, baseUrl: (env.CLINE_BASE_URL?.trim() || DEFAULT_BASE_URL).replace(/\/+$/, "") };
}

/** True when a key and model are configured (does not call the model). */
export function isAiConfigured(env: Record<string, string | undefined> = process.env): boolean {
  return configFrom(env) !== null;
}

const defaultLog = (entry: AiLogEntry) => console.info(`[ai] ${JSON.stringify(entry)}`);

const DATA_URL = /^data:(image\/(?:jpeg|png|webp|gif|heic|heif));base64,/i;
const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/;

/** Accepts a data URL or bare base64. Returns null if it is not a plausible image of allowed size. */
export function parseImage(input: string): { mime: string; data: string } | null {
  const m = DATA_URL.exec(input);
  const mime = m ? m[1].toLowerCase() : "image/jpeg";
  const data = (m ? input.slice(m[0].length) : input).replace(/\s/g, "");
  if (data.length < 16 || data.length % 4 !== 0 || !BASE64.test(data)) return null;
  if ((data.length / 4) * 3 > MAX_IMAGE_BYTES) return null;
  return { mime, data };
}

const SYSTEM_PROMPT = `You read photos of Indian government documents for a welfare-application checker.
Return ONLY one JSON object, no other text:
{"docType": string, "fields": {...}, "confidence": {...}}
- docType: one of ${DocTypeSchema.options.join(", ")}.
- fields (omit any you cannot read; never guess):
  name: the person's name exactly as printed (keep the original script and spelling);
  dob: date of birth as YYYY-MM-DD;
  aadhaarLast4: ONLY the last 4 digits of the Aadhaar number. Never return the full Aadhaar number;
  accountNo: bank account number, digits only;
  ifsc: IFSC code;
  ownerNames: array of land owner names as printed (land records).
- confidence: for each field you returned, a number from 0 to 1 for how sure you are of the exact text.`;

function userPrompt(hint?: DocType): string {
  return hint
    ? `The user says this photo is a ${hint}. Read it and return the JSON.`
    : "Read this document photo and return the JSON.";
}

/** Pulls the first JSON object out of the model's reply (tolerates code fences or extra words). */
export function jsonFromReply(content: string): unknown {
  const start = content.indexOf("{");
  const end = content.lastIndexOf("}");
  if (start < 0 || end <= start) throw new SyntaxError("no JSON object in reply");
  return JSON.parse(content.slice(start, end + 1));
}

type Completion = { choices?: { message?: { content?: unknown } }[] };

/** The reply text. The Cline API wraps the OpenAI-style body in `{ data: { choices } }`; plain bodies work too. */
export function replyText(body: unknown): string {
  const b = body as (Completion & { data?: Completion }) | null;
  const content = (b?.choices ?? b?.data?.choices)?.[0]?.message?.content;
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content.map((p: { text?: unknown }) => (typeof p?.text === "string" ? p.text : "")).join("");
  }
  return "";
}

/**
 * Reads one document photo → ExtractedDoc with per-field confidence (Aadhaar reduced to the last 4 digits).
 * Returns `{ error: "ai_unavailable" }` when no key/model is configured, so the UI falls back to manual entry.
 */
export async function extractDocument(imageBase64: string, hintDocType?: DocType, deps: AiDeps = {}): Promise<ExtractResult> {
  const log = deps.log ?? defaultLog;
  const config = configFrom(deps.env ?? process.env);
  const base = { fn: "extractDocument" as const, model: config?.model ?? null, promptVersion: EXTRACT_PROMPT_VERSION };

  if (!config) {
    log({ ...base, inputHash: null, attempt: 0, outcome: "unavailable" });
    return { error: "ai_unavailable" };
  }
  const image = parseImage(imageBase64);
  if (!image) {
    log({ ...base, inputHash: null, attempt: 0, outcome: "invalid_image" });
    return { error: "invalid_image" };
  }
  const inputHash = createHash("sha256").update(image.data).update(hintDocType ?? "").digest("hex").slice(0, 16);
  const doFetch = deps.fetch ?? fetch;
  const body = JSON.stringify({
    model: config.model,
    temperature: 0,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: [
          { type: "text", text: userPrompt(hintDocType) },
          { type: "image_url", image_url: { url: `data:${image.mime};base64,${image.data}` } },
        ],
      },
    ],
  });

  // First attempt + one retry, then the safe fallback.
  for (let attempt = 1; attempt <= 2; attempt++) {
    const started = Date.now();
    const entry = { ...base, inputHash, attempt };
    try {
      const res = await doFetch(`${config.baseUrl}/chat/completions`, {
        method: "POST",
        headers: { Authorization: `Bearer ${config.apiKey}`, "Content-Type": "application/json" },
        body,
        signal: AbortSignal.timeout(deps.timeoutMs ?? DEFAULT_TIMEOUT_MS),
      });
      if (!res.ok) {
        log({ ...entry, outcome: "http_error", status: res.status, ms: Date.now() - started });
        continue;
      }
      const json: unknown = await res.json();
      const raw = RawExtraction.safeParse(jsonFromReply(replyText(json)));
      if (!raw.success) {
        log({ ...entry, outcome: "bad_output", ms: Date.now() - started });
        continue;
      }
      const result = toExtractedDoc(raw.data, hintDocType);
      log({ ...entry, outcome: "ok", ms: Date.now() - started });
      return result;
    } catch (e) {
      log({ ...entry, outcome: e instanceof SyntaxError ? "bad_output" : "network_error", ms: Date.now() - started });
    }
  }
  return { error: "ai_failed" };
}


// ---------- tool-using agent (Cline SDK) ----------
// The Rule Maintenance Agent runs here, so this file stays the one place that talks to a model.
// The agent can only act through the tools it is given; its free text never decides anything.

/** The part of the `@cline/sdk` Agent we use (lets tests inject a fake). */
export interface AgentLike {
  run(input: string): Promise<{ status: string; outputText: string; iterations: number; error?: Error }>;
  subscribe(listener: (event: { type: string } & Record<string, unknown>) => void): () => void;
  abort(reason?: unknown): void;
}

export type AgentFactory = (config: Record<string, unknown>) => AgentLike | Promise<AgentLike>;

export interface ToolAgentDeps {
  env?: Record<string, string | undefined>;
  log?: (entry: AiLogEntry) => void;
  createAgent?: AgentFactory;
  timeoutMs?: number;
}

export interface ToolAgentRequest {
  promptVersion: string;
  systemPrompt: string;
  input: string;
  /** Tools made with `createTool` from `@cline/sdk` (zod input schemas). */
  tools: readonly unknown[];
  maxIterations?: number;
  onEvent?: (event: { type: string } & Record<string, unknown>) => void;
  signal?: AbortSignal;
  deps?: ToolAgentDeps;
}

export type ToolAgentResult = { status: "completed" | "aborted"; outputText: string; attempts: number } | { error: "ai_unavailable" | "ai_failed" };

const AGENT_TIMEOUT_MS = 240_000;

/** The real factory: `new Agent(...)` from `@cline/sdk`, loaded only when an agent actually runs. */
const sdkAgentFactory: AgentFactory = async (config) => {
  const { Agent } = await import("@cline/sdk");
  return new Agent(config as unknown as ConstructorParameters<typeof Agent>[0]) as unknown as AgentLike;
};

/**
 * Runs a Cline SDK agent with the given tools against the Cline API (OpenAI-compatible).
 * One retry if the run failed before any tool ran; then `{ error: "ai_failed" }`. Never throws.
 */
export async function runToolAgent(req: ToolAgentRequest): Promise<ToolAgentResult> {
  const deps = req.deps ?? {};
  const log = deps.log ?? defaultLog;
  const config = configFrom(deps.env ?? process.env);
  const inputHash = createHash("sha256").update(req.input).digest("hex").slice(0, 16);
  const base = { fn: "runToolAgent" as const, model: config?.model ?? null, promptVersion: req.promptVersion, inputHash };

  if (!config) {
    log({ ...base, inputHash: null, attempt: 0, outcome: "unavailable" });
    return { error: "ai_unavailable" };
  }
  const createAgent = deps.createAgent ?? sdkAgentFactory;

  for (let attempt = 1; attempt <= 2; attempt++) {
    const started = Date.now();
    let toolCalls = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let agent: AgentLike | undefined;
    const onAbort = () => agent?.abort("cancelled");
    try {
      agent = await createAgent({
        providerId: "openai-compatible",
        baseUrl: config.baseUrl,
        apiKey: config.apiKey,
        modelId: config.model,
        systemPrompt: req.systemPrompt,
        tools: req.tools,
        maxIterations: req.maxIterations ?? 16,
        toolExecution: "sequential",
      });
      agent.subscribe((event) => {
        if (event.type === "tool-finished") toolCalls++;
        req.onEvent?.(event);
      });
      req.signal?.addEventListener("abort", onAbort, { once: true });
      timer = setTimeout(() => agent?.abort("timeout"), deps.timeoutMs ?? AGENT_TIMEOUT_MS);
      const result = await agent.run(req.input);
      const ms = Date.now() - started;
      if (result.status === "completed" || result.status === "aborted") {
        log({ ...base, attempt, outcome: result.status === "completed" ? "ok" : "run_failed", ms, toolCalls });
        return { status: result.status, outputText: result.outputText, attempts: attempt };
      }
      log({ ...base, attempt, outcome: "run_failed", ms, toolCalls });
    } catch {
      log({ ...base, attempt, outcome: "network_error", ms: Date.now() - started, toolCalls });
    } finally {
      if (timer) clearTimeout(timer);
      req.signal?.removeEventListener("abort", onAbort);
    }
    // Retry only if nothing happened yet: a second run after tool calls could repeat side effects.
    if (toolCalls > 0 || req.signal?.aborted) break;
  }
  return { error: "ai_failed" };
}

