"use client";
// The rule maintainer's flow: paste a notice → the Cline SDK agent works (live tool log) →
// readable diff + test results → a person publishes or rejects. Version history per scheme.
import Link from "next/link";
import { useCallback, useRef, useState } from "react";
import { Card, btn } from "../_components/ui";
import { AgentLog, type LogLine } from "./AgentLog";
import { ProposalCard, type Proposal } from "./ProposalCard";
import { VersionHistory, type SchemeHistory } from "./VersionHistory";

export interface DemoNotice {
  id: string;
  label: string;
  text: string;
}

type RunResult = { ok: true; proposal: Proposal; agentText: string } | { ok: false; error: string; message: string; agentText?: string };
type AgentEvent =
  | { type: "status"; message: string }
  | { type: "tool"; id: string; name: string; phase: "started" | "finished"; summary: string; isError?: boolean }
  | { type: "text"; text: string }
  | { type: "done"; result: RunResult };

/** Reads an NDJSON response body line by line. */
async function readNdjson(body: ReadableStream<Uint8Array>, onLine: (value: unknown) => void) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) if (line.trim()) onLine(JSON.parse(line));
  }
  if (buffer.trim()) onLine(JSON.parse(buffer));
}

export function AdminApp({ demos, initialHistory }: { demos: DemoNotice[]; initialHistory: SchemeHistory[] }) {
  const [notice, setNotice] = useState("");
  const [running, setRunning] = useState(false);
  const [log, setLog] = useState<LogLine[]>([]);
  const [agentText, setAgentText] = useState("");
  const [result, setResult] = useState<RunResult | null>(null);
  const [history, setHistory] = useState<SchemeHistory[]>(initialHistory);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/rules", { cache: "no-store" });
      if (res.ok) setHistory(((await res.json()) as { schemes: SchemeHistory[] }).schemes);
    } catch {
      // The history is a convenience; the page still works without it.
    }
  }, []);

  function onEvent(e: AgentEvent) {
    if (e.type === "tool") {
      setLog((l) => {
        const i = e.id ? l.findIndex((x) => x.id === e.id) : -1;
        const line: LogLine = { id: e.id || `line-${l.length}`, name: e.name, summary: e.summary, phase: e.phase, isError: e.isError };
        if (e.phase === "finished" && i >= 0) return l.map((x, j) => (j === i ? { ...line, request: x.summary } : x));
        return [...l, line];
      });
    } else if (e.type === "text") setAgentText(e.text);
    else if (e.type === "done") setResult(e.result);
  }

  async function run() {
    setRunning(true);
    setLog([]);
    setAgentText("");
    setResult(null);
    setMessage(null);
    const abort = new AbortController();
    abortRef.current = abort;
    try {
      const res = await fetch("/api/admin/rules/propose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notice }),
        signal: abort.signal,
      });
      if (!res.ok || !res.body) {
        setResult({ ok: false, error: "request_failed", message: `The request was refused (${res.status}).` });
        return;
      }
      await readNdjson(res.body, (v) => onEvent(v as AgentEvent));
    } catch {
      if (!abort.signal.aborted) setResult({ ok: false, error: "network", message: "The connection to the agent was lost." });
    } finally {
      setRunning(false);
      abortRef.current = null;
      void refresh();
    }
  }

  async function decide(id: number, decision: "publish" | "reject") {
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/rules/${id}/${decision}`, { method: "POST" });
      const body = (await res.json()) as { row?: { schemeId: string; version: string }; errors?: string[] };
      if (!res.ok || !body.row) {
        setMessage({ tone: "error", text: (body.errors ?? ["Not allowed."]).join(" ") });
        return;
      }
      setMessage({
        tone: "ok",
        text:
          decision === "publish"
            ? `Published ${body.row.schemeId} ${body.row.version}. Citizens see it now; the old version is kept.`
            : `Rejected ${body.row.schemeId} ${body.row.version}. Nothing changed for citizens.`,
      });
      const status = decision === "publish" ? "published" : "rejected";
      setResult((r) => (r && r.ok && r.proposal.id === id ? { ...r, proposal: { ...r.proposal, status } } : r));
    } catch {
      setMessage({ tone: "error", text: "Could not reach the server." });
    } finally {
      void refresh();
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-5 px-4 pb-12 pt-6" lang="en">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-teal-800">KaagazCheck · rule maintainers</p>
          <h1 className="text-2xl font-bold">Rule Maintenance Agent</h1>
          <p className="mt-1 text-zinc-700">
            Paste an official notice. A Cline SDK agent proposes a rule change with sources and tests, runs it through the rule engine,
            and waits for your approval. It can only use its five tools: it cannot edit code or publish.
          </p>
        </div>
        <Link href="/" className={btn.quiet}>
          ← Citizen app
        </Link>
      </header>

      <Card>
        <label htmlFor="notice" className="text-lg font-semibold">
          Scheme notice
        </label>
        <div className="mt-2 flex flex-wrap gap-2">
          {demos.map((d) => (
            <button key={d.id} type="button" className={`${btn.secondary} text-left`} disabled={running} onClick={() => setNotice(d.text)}>
              📄 {d.label}
            </button>
          ))}
        </div>
        <textarea
          id="notice"
          value={notice}
          onChange={(e) => setNotice(e.target.value)}
          rows={8}
          maxLength={20000}
          placeholder="Paste the text of a government notice or guideline…"
          className="mt-3 w-full rounded-xl border-2 border-zinc-300 bg-white px-3 py-2 text-base focus-visible:outline-3 focus-visible:outline-teal-500"
        />
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" className={btn.primary} disabled={running || notice.trim() === ""} onClick={() => void run()}>
            {running ? "⏳ Agent is working…" : "🤖 Propose rule change"}
          </button>
          {running && (
            <button type="button" className={btn.quiet} onClick={() => abortRef.current?.abort()}>
              Stop
            </button>
          )}
        </div>
      </Card>

      {(running || log.length > 0) && <AgentLog lines={log} running={running} agentText={agentText} />}

      {result && !result.ok && (
        <p role="alert" className="rounded-xl border-l-8 border-red-700 bg-red-50 p-4 text-red-950">
          {result.message}
        </p>
      )}
      {message && (
        <p role="status" className={`rounded-xl p-3 font-medium ${message.tone === "ok" ? "bg-green-50 text-green-900" : "bg-red-50 text-red-900"}`}>
          {message.text}
        </p>
      )}
      {result && result.ok && <ProposalCard proposal={result.proposal} onDecide={decide} />}

      <VersionHistory schemes={history} onDecide={decide} />
    </div>
  );
}

