"use client";
// The rule maintainer's flow: paste a notice → the Cline SDK agent works (live tool log) →
// readable diff + test results → a person publishes or rejects. Version history per scheme.
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Card, btn } from "../_components/ui";
import { AgentLog, type LogLine } from "./AgentLog";
import { setStoredPasscode, useStoredPasscode } from "./passcode";
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

const WRONG_PASSCODE = "Wrong or missing passcode. Please enter it again.";

export function AdminApp({
  demos,
  initialHistory,
  passcodeRequired,
}: {
  demos: DemoNotice[];
  initialHistory: SchemeHistory[];
  passcodeRequired: boolean;
}) {
  const passcode = useStoredPasscode();
  const locked = passcodeRequired && passcode === "";
  /** Headers for every /api/admin/* request (the passcode only when one is stored). */
  const auth = useCallback((extra: Record<string, string> = {}): Record<string, string> => (passcode ? { ...extra, "x-admin-passcode": passcode } : extra), [passcode]);
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
      const res = await fetch("/api/admin/rules", { cache: "no-store", headers: auth() });
      if (res.status === 401) {
        setMessage({ tone: "error", text: WRONG_PASSCODE });
        setStoredPasscode("");
        return;
      }
      if (res.ok) setHistory(((await res.json()) as { schemes: SchemeHistory[] }).schemes);
    } catch {
      // The history is a convenience; the page still works without it.
    }
  }, [auth]);

  // Protected mode: the server sends no history until the passcode is known; load it once it is.
  useEffect(() => {
    if (!passcodeRequired || !passcode) return;
    let live = true;
    fetch("/api/admin/rules", { cache: "no-store", headers: { "x-admin-passcode": passcode } })
      .then(async (res) => {
        if (!live) return;
        if (res.status === 401) {
          setMessage({ tone: "error", text: WRONG_PASSCODE });
          setStoredPasscode("");
        } else if (res.ok) {
          setHistory(((await res.json()) as { schemes: SchemeHistory[] }).schemes);
        }
      })
      .catch(() => {
        // The history is a convenience; the page still works without it.
      });
    return () => {
      live = false;
    };
  }, [passcodeRequired, passcode]);

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
        headers: auth({ "Content-Type": "application/json" }),
        body: JSON.stringify({ notice }),
        signal: abort.signal,
      });
      if (res.status === 401) {
        setResult({ ok: false, error: "passcode_required", message: WRONG_PASSCODE });
        setStoredPasscode("");
        return;
      }
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
      const res = await fetch(`/api/admin/rules/${id}/${decision}`, { method: "POST", headers: auth() });
      if (res.status === 401) {
        setMessage({ tone: "error", text: WRONG_PASSCODE });
        setStoredPasscode("");
        return;
      }
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

      {!passcodeRequired && (
        <p role="note" className="rounded-xl border-2 border-dashed border-amber-600 bg-amber-50 px-3 py-2 font-semibold text-amber-950">
          ⚠️ Demo mode: unprotected. Anyone who can open this page can run the agent and publish rules. Set ADMIN_PASSCODE in .env.local to
          require a passcode.
        </p>
      )}

      {message && locked && (
        <p role="alert" className="rounded-xl bg-red-50 p-3 font-medium text-red-900">
          {message.text}
        </p>
      )}
      {locked ? (
        <PasscodeBox
          onSubmit={(p) => {
            setMessage(null);
            setStoredPasscode(p);
          }}
        />
      ) : (
        <>
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
        </>
      )}
      {passcodeRequired && !locked && (
        <button type="button" className={`${btn.quiet} self-start`} onClick={() => setStoredPasscode("")}>
          🔒 Lock (forget the passcode in this tab)
        </button>
      )}
    </div>
  );
}

function PasscodeBox({ onSubmit }: { onSubmit: (passcode: string) => void }) {
  const [value, setValue] = useState("");
  return (
    <Card>
      <form
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (value.trim()) onSubmit(value.trim());
        }}
      >
        <label htmlFor="admin-passcode" className="text-lg font-semibold">
          🔒 Admin passcode
        </label>
        <p className="text-zinc-700">This page is protected. Enter the passcode from the organiser. It is kept only in this browser tab.</p>
        <input
          id="admin-passcode"
          type="password"
          autoComplete="current-password"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="min-h-12 w-full rounded-xl border-2 border-zinc-300 bg-white px-3 py-2 text-base focus-visible:outline-3 focus-visible:outline-teal-500"
        />
        <button type="submit" className={`${btn.primary} self-start`} disabled={value.trim() === ""}>
          Unlock
        </button>
      </form>
    </Card>
  );
}

