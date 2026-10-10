// Handlers for the admin (rule maintainer) API. The route files are thin wrappers.
// POST /api/admin/rules/propose streams the agent's tool calls as NDJSON (one JSON object per line).
import { z } from "zod";
import { MAX_NOTICE_CHARS } from "@/core/notice";
import { getScheme, listSchemes, listSchemeVersions } from "@/core/schemes";
import type { SchemeRule } from "@/core/types";
import { proposalView, runRuleAgent, type AgentEvent, type ProposalView } from "./agents/ruleMaintenance";
import { getRuleService } from "./rules";
import type { RuleVersionRow } from "./store";

const json = (body: unknown, status = 200) => Response.json(body, { status });

export const ProposeRequest = z.object({ notice: z.string().trim().min(1).max(MAX_NOTICE_CHARS) });

async function readJson(req: Request): Promise<unknown> {
  try {
    return JSON.parse(await req.text());
  } catch {
    return undefined;
  }
}

export async function handlePropose(req: Request): Promise<Response> {
  const body = await readJson(req);
  if (body === undefined) return json({ error: "invalid_json" }, 400);
  const parsed = ProposeRequest.safeParse(body);
  if (!parsed.success) return json({ error: "invalid_request", issues: parsed.error.issues.map((i) => ({ path: i.path.join("."), code: i.code })) }, 400);

  const encoder = new TextEncoder();
  const abort = new AbortController();
  req.signal?.addEventListener("abort", () => abort.abort(), { once: true });
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (e: AgentEvent) => {
        try {
          controller.enqueue(encoder.encode(`${JSON.stringify(e)}\n`));
        } catch {
          // The stream is closed (the client left); the run is being aborted below.
        }
      };
      try {
        await runRuleAgent(parsed.data.notice, { onEvent: send, signal: abort.signal });
      } catch {
        send({ type: "done", result: { ok: false, error: "ai_failed", message: "The agent stopped unexpectedly. Nothing was published." } });
      } finally {
        controller.close();
      }
    },
    cancel() {
      abort.abort();
    },
  });
  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" } });
}

export interface SchemeHistory {
  id: string;
  nameEn: string;
  liveVersion: string | null;
  builtinVersion: string | null;
  /** Newest first. */
  versions: ProposalView[];
}

/**
 * Newest first. Each row is diffed against the version that was live when it was proposed:
 * the last version published before it, or the built-in pack (null for a brand-new scheme).
 */
function historyOf(builtin: SchemeRule | null, rows: RuleVersionRow[]): ProposalView[] {
  let live = builtin;
  const views: ProposalView[] = [];
  for (const row of [...rows].reverse()) {
    views.push(proposalView(row, live));
    if (row.status === "published") live = row.rule;
  }
  return views.reverse();
}

/** The built-in (code) version of a scheme, if it has one. */
function builtinOf(schemeId: string, rows: RuleVersionRow[]): SchemeRule | null {
  const first = listSchemeVersions(schemeId)[0];
  if (!first || rows.some((r) => r.version === first && r.status === "published")) return null;
  return getScheme(schemeId, first) ?? null;
}

export async function handleList(): Promise<Response> {
  return json({ schemes: schemeHistories() });
}

/** Every scheme (built-in and agent-added) with its live version and history. */
export function schemeHistories(): SchemeHistory[] {
  const svc = getRuleService();
  const rows = svc.history();
  const ids = [...new Set([...listSchemes().map((s) => s.id), ...rows.map((r) => r.schemeId)])];
  const schemes: SchemeHistory[] = ids.map((id) => {
    const live = getScheme(id);
    const own = rows.filter((r) => r.schemeId === id);
    const builtin = builtinOf(id, own);
    return {
      id,
      nameEn: live?.nameEn ?? own[0]?.rule.nameEn ?? id,
      liveVersion: live?.version ?? null,
      builtinVersion: builtin?.version ?? null,
      versions: historyOf(builtin, own),
    };
  });
  return schemes;
}

const Id = z.coerce.number().int().positive();

export async function handleDecision(idParam: string, decision: "publish" | "reject"): Promise<Response> {
  const id = Id.safeParse(idParam);
  if (!id.success) return json({ error: "invalid_id" }, 400);
  const svc = getRuleService();
  const res = decision === "publish" ? svc.publish(id.data) : svc.reject(id.data);
  if (!res.ok) return json({ error: "not_allowed", errors: res.errors }, 409);
  return json({ row: { id: res.row.id, schemeId: res.row.schemeId, version: res.row.version, status: res.row.status, approvedAt: res.row.approvedAt } });
}
