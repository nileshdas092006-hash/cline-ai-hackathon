// The Rule Maintenance Agent: a @cline/sdk Agent that turns a scheme notice into a proposed,
// tested rule-pack version. It acts ONLY through these five tools (zod inputs); it never writes
// files and never publishes. Every check (schema, policy, tests) is code; a person approves.
import { createTool } from "@cline/sdk";
import { z } from "zod";
import { summarizeToolInput, summarizeToolOutput } from "@/core/agentLog";
import { normalizeNotice } from "@/core/notice";
import { diffRules, type RuleChange } from "@/core/ruleDiff";
import { MIN_NEW_TESTS } from "@/core/rulePolicy";
import { RuleTestCase, type TestReport } from "@/core/ruleTests";
import { listSchemes } from "@/core/schemes";
import { SchemeRule } from "@/core/types";
import { runToolAgent, type ToolAgentDeps } from "../ai";
import { getRuleService, type RuleService } from "../rules";
import type { RuleVersionStatus } from "../store";

export const RULE_AGENT_PROMPT_VERSION = "rule-agent-v2";

export const SYSTEM_PROMPT = `You maintain the rule packs of KaagazCheck, a welfare-application checker for Assam, India.
You receive the text of an official scheme notice or guideline. Turn it into a proposed rule-pack version, tested, for a human to approve.
You can act ONLY through your tools. You cannot edit files, and you cannot publish: a person reviews and publishes.

Steps:
1. Call getRuleSchema once to see the rule format, one example, and the existing schemes.
2. Decide: is this a change to an existing scheme, or a new scheme? If it changes one, call getCurrentRule(schemeId) to see the live rule and its regression tests.
3. Call proposeRule with the SMALLEST change that matches the notice:
   - Existing scheme: pass { schemeId, patch } where patch is a JSON merge patch on the current rule (objects merge, arrays are replaced whole, null deletes). Bump version (e.g. 2.0.0 → 2.1.0).
   - New scheme: pass { rule } with a full rule; a new kebab-case id; version "1.0.0".
   - A temporary payment change is a benefit override (from/to dates, amount), not a change to the regular amount.
4. Call runTests with at least ${MIN_NEW_TESTS} NEW test cases for what the notice says (amounts on dates inside and outside any window, eligibility edges such as ages just inside and outside a limit, a missing required document). Existing regression tests run automatically and must keep passing. If something fails, fix the rule or a wrong test and run again.
5. When proposeRule is valid and every test passes, call saveProposal once with the same tests, a one-line sourceNote, and a short plain-English summary for the reviewer.

Rules:
- Never invent criteria, amounts, documents or dates that are not in the notice. If something is unclear or missing, leave it out and say so in a scheme note (notes) and in the summary.
- ageRange.max is optional. If the notice gives no upper age limit (e.g. "60 years and above"), leave max out; never use a placeholder such as 120.
- Provenance on every rule you add or change: sourceTitle, clause (quote or paraphrase the notice), effectiveDate if stated, verifiedOn = today's date given below, version = the new version.
  status "verified" ONLY with an official sourceUrl that appears in the notice text; otherwise status "provisional" with sourceUrl null (or the notice's URL if it is not official). Keep untouched provenance as it is.
- Write Assamese (…As fields) in Assamese script (use ৰ and ৱ); it will be reviewed by a native speaker.
- Use only these document types, places and fields from the schema. Keep test ids short, lowercase, unique, not reusing regression test ids.
- Do not paste the whole rule back when a patch will do. Be concise in your final message (one or two sentences).`;

export interface AgentSession {
  notice: string;
  /** The last rule that passed proposeRule (schema + policy). */
  candidate: SchemeRule | null;
  /** The live version it changes, or null for a new scheme. */
  previous: SchemeRule | null;
  savedId: number | null;
}

export function newSession(notice: string): AgentSession {
  return { notice, candidate: null, previous: null, savedId: null };
}

function exampleRule() {
  // The widow pension is the smallest complete built-in rule; its shape is the best example.
  return listSchemes().find((s) => s.id === "nsap-widow");
}

const ProposeInput = z.object({
  schemeId: z.string().max(64).optional().describe("Existing scheme id when sending a patch."),
  patch: z.record(z.string(), z.unknown()).optional().describe("JSON merge patch on the current rule of schemeId."),
  rule: z.record(z.string(), z.unknown()).optional().describe("A full SchemeRule (for a new scheme)."),
});

const TestsInput = z.object({
  tests: z.array(z.record(z.string(), z.unknown())).min(1).max(30).describe("Test cases (see testCase in getRuleSchema)."),
});

const SaveInput = TestsInput.extend({
  sourceNote: z.string().min(1).max(300).describe("Where the change comes from, in one line."),
  summary: z.string().min(1).max(1000).describe("Plain-English summary of the change for the reviewer."),
});

/**
 * `createTool` passes the model's raw input to `execute` without checking it, so every tool
 * re-validates with its own zod schema and returns `{ error }` (seen by the model) instead of throwing.
 */
function checked<S extends z.ZodType, R>(schema: S, fn: (input: z.infer<S>) => Promise<R>) {
  return async (input: unknown): Promise<R | { error: string }> => {
    const parsed = schema.safeParse(input);
    if (!parsed.success) {
      const why = parsed.error.issues.slice(0, 5).map((i) => `${i.path.join(".") || "(input)"}: ${i.message}`);
      return { error: `invalid input: ${why.join("; ")}` };
    }
    return fn(parsed.data);
  };
}

/** The five tools. They share `session`, so runTests/saveProposal use the last valid proposal. */
export function createRuleTools(service: RuleService, session: AgentSession) {
  const getRuleSchema = createTool({
    name: "getRuleSchema",
    description: "The SchemeRule JSON schema, the test-case JSON schema, one complete example rule, and the existing schemes.",
    inputSchema: z.object({}),
    execute: async () => ({
      schemeRule: z.toJSONSchema(SchemeRule, { io: "input", unrepresentable: "any" }),
      testCase: z.toJSONSchema(RuleTestCase, { io: "input", unrepresentable: "any" }),
      example: exampleRule(),
      schemes: listSchemes().map((s) => ({ id: s.id, version: s.version, nameEn: s.nameEn })),
      today: new Date().toISOString().slice(0, 10),
    }),
  });

  const CurrentInput = z.object({ schemeId: z.string().min(1).max(64) });
  const getCurrentRule = createTool({
    name: "getCurrentRule",
    description: "The current published rule of a scheme and the regression tests every new version must still pass.",
    inputSchema: CurrentInput,
    execute: checked(CurrentInput, async ({ schemeId }) => {
      const rule = service.currentRule(schemeId);
      if (!rule) return { found: false, schemeId, note: "No such scheme: propose a full rule to add it." };
      return { found: true, rule, regressionTests: service.regressionTests(schemeId) };
    }),
  });

  const proposeRule = createTool({
    name: "proposeRule",
    description:
      "Validate a proposed rule (schema + policy). Pass {schemeId, patch} to change an existing scheme, or {rule} for a new one. Returns the problems, or valid + the list of changes.",
    inputSchema: ProposeInput,
    execute: checked(ProposeInput, async (input) => {
      const cand = service.candidate(input);
      if (!cand.ok) return { valid: false, errors: cand.errors };
      const res = service.validate(cand.value, session.notice);
      if (!res.ok) return { valid: false, errors: res.errors };
      session.candidate = res.rule;
      session.previous = res.current;
      const changes = diffRules(res.current, res.rule);
      return { valid: true, schemeId: res.rule.id, version: res.rule.version, isNewScheme: res.current === null, changes: changes.slice(0, 40) };
    }),
  });

  const runTests = createTool({
    name: "runTests",
    description: "Run your new test cases AND all regression tests of the scheme against the last valid proposal, through the real rule engine.",
    inputSchema: TestsInput,
    execute: checked(TestsInput, async ({ tests }) => {
      if (!session.candidate) return { ok: false, errors: ["call proposeRule first (with a valid rule)"] };
      const res = service.runTests(session.candidate, tests);
      if (!res.ok) return { ok: false, errors: res.errors };
      const { total, passed, failed } = res.report;
      return { ok: true, total, passed, failed, results: res.report.results };
    }),
  });

  const saveProposal = createTool({
    name: "saveProposal",
    description: "Store the last valid proposal with its tests as 'proposed' for a person to review. Refused unless every test passes. Call once.",
    inputSchema: SaveInput,
    execute: checked(SaveInput, async ({ tests, sourceNote, summary }) => {
      if (session.savedId !== null) return { saved: false, errors: [`already saved as proposal #${session.savedId}`] };
      if (!session.candidate) return { saved: false, errors: ["call proposeRule first (with a valid rule)"] };
      const res = service.saveProposal({ rule: session.candidate, tests, sourceNote, summary, notice: session.notice });
      if (!res.ok) return { saved: false, errors: res.errors };
      session.savedId = res.row.id;
      return { saved: true, id: res.row.id, schemeId: res.row.schemeId, version: res.row.version, status: res.row.status };
    }),
  });

  return [getRuleSchema, getCurrentRule, proposeRule, runTests, saveProposal];
}

// ---------- the run ----------

export interface ProposalView {
  id: number;
  schemeId: string;
  version: string;
  previousVersion: string | null;
  nameEn: string;
  status: RuleVersionStatus;
  sourceNote: string;
  summary: string;
  createdAt: string;
  approvedAt: string | null;
  changes: RuleChange[];
  testResult: TestReport;
}

/** What the admin UI shows for one stored version: diff against the version before it. */
export function proposalView(row: { id: number; schemeId: string; version: string; rule: SchemeRule; status: RuleVersionStatus; sourceNote: string; summary: string; createdAt: string; approvedAt: string | null; testResult: TestReport }, previous: SchemeRule | null): ProposalView {
  return {
    id: row.id,
    schemeId: row.schemeId,
    version: row.version,
    previousVersion: previous?.version ?? null,
    nameEn: row.rule.nameEn,
    status: row.status,
    sourceNote: row.sourceNote,
    summary: row.summary,
    createdAt: row.createdAt,
    approvedAt: row.approvedAt,
    changes: diffRules(previous, row.rule),
    testResult: row.testResult,
  };
}

export type AgentEvent =
  | { type: "status"; message: string }
  | { type: "tool"; id: string; name: string; phase: "started" | "finished"; summary: string; isError?: boolean }
  | { type: "text"; text: string }
  | { type: "done"; result: AgentRunResult };

export type AgentRunResult =
  | { ok: true; proposal: ProposalView; agentText: string }
  | { ok: false; error: "empty_notice" | "ai_unavailable" | "ai_failed" | "no_proposal"; message: string; agentText?: string };


const RESULT_MESSAGES = {
  empty_notice: "Paste the notice text first.",
  ai_unavailable: "The AI is not configured (CLINE_API_KEY / CLINE_MODEL). Nothing was changed.",
  ai_failed: "The agent could not finish. Nothing was published; try again.",
  no_proposal: "The agent finished without saving a valid, fully tested proposal. Nothing was published.",
} as const;

type ToolEvent = { type: string; toolCall?: { toolCallId?: string; toolName?: string; input?: unknown }; message?: { content?: { type?: string; output?: unknown; isError?: boolean }[] }; accumulatedText?: string };

/** Turns raw SDK events into short UI events (tool name + one-line summary). */
function toAgentEvent(e: ToolEvent): AgentEvent | null {
  const call = e.toolCall;
  if (e.type === "tool-started" && call?.toolName) {
    return { type: "tool", id: call.toolCallId ?? "", name: call.toolName, phase: "started", summary: summarizeToolInput(call.toolName, call.input) };
  }
  if (e.type === "tool-finished" && call?.toolName) {
    const part = e.message?.content?.find((p) => p.type === "tool-result");
    const output = part?.output;
    const failed = part?.isError === true || (typeof output === "object" && output !== null && ["valid", "ok", "saved"].some((k) => (output as Record<string, unknown>)[k] === false));
    return { type: "tool", id: call.toolCallId ?? "", name: call.toolName, phase: "finished", summary: summarizeToolOutput(call.toolName, output), isError: failed };
  }
  return null;
}

export interface RunOptions {
  service?: RuleService;
  onEvent?: (event: AgentEvent) => void;
  signal?: AbortSignal;
  aiDeps?: ToolAgentDeps;
}

/** Runs the agent on a notice. The result is decided by what was saved through the tools, not by the agent's text. */
export async function runRuleAgent(noticeText: string, opts: RunOptions = {}): Promise<AgentRunResult> {
  const emit = opts.onEvent ?? (() => undefined);
  const finish = (result: AgentRunResult) => {
    emit({ type: "done", result });
    return result;
  };
  const notice = normalizeNotice(noticeText);
  if (!notice) return finish({ ok: false, error: "empty_notice", message: RESULT_MESSAGES.empty_notice });

  const service = opts.service ?? getRuleService();
  const session = newSession(notice);
  const today = new Date().toISOString().slice(0, 10);
  emit({ type: "status", message: "Agent started" });

  let lastText = "";
  const run = await runToolAgent({
    promptVersion: RULE_AGENT_PROMPT_VERSION,
    systemPrompt: `${SYSTEM_PROMPT}\n\nToday's date: ${today}.`,
    input: `Scheme notice:\n"""\n${notice}\n"""`,
    tools: createRuleTools(service, session),
    maxIterations: 16,
    signal: opts.signal,
    deps: opts.aiDeps,
    onEvent: (raw) => {
      const e = raw as ToolEvent;
      if (e.type === "assistant-text-delta" && typeof e.accumulatedText === "string") lastText = e.accumulatedText;
      const ev = toAgentEvent(e);
      if (ev) emit(ev);
    },
  });
  if (lastText) emit({ type: "text", text: lastText.slice(0, 2000) });

  // Even if the run ended badly, a proposal saved through the tools is valid and fully tested.
  const row = session.savedId !== null ? service.get(session.savedId) : undefined;
  if (row) return finish({ ok: true, proposal: proposalView(row, session.previous), agentText: lastText });
  if ("error" in run) return finish({ ok: false, error: run.error, message: RESULT_MESSAGES[run.error], agentText: lastText });
  return finish({ ok: false, error: "no_proposal", message: RESULT_MESSAGES.no_proposal, agentText: run.outputText || lastText });
}

