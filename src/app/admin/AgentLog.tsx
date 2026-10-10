// The live tool-call log: one line per tool call, updated when it finishes.
import { Card } from "../_components/ui";

export interface LogLine {
  id: string;
  name: string;
  summary: string;
  /** The "started" summary, kept once the call finishes. */
  request?: string;
  phase: "started" | "finished";
  isError?: boolean;
}

export function AgentLog({ lines, running, agentText }: { lines: LogLine[]; running: boolean; agentText: string }) {
  return (
    <Card>
      <h2 className="text-lg font-semibold">Agent log</h2>
      <p className="text-sm text-zinc-600">Each line is a tool call made by the Cline SDK agent.</p>
      <ol className="mt-3 flex flex-col gap-2" aria-live="polite">
        {lines.map((l, i) => {
          const icon = l.phase === "started" ? "⏳" : l.isError ? "⚠️" : "✅";
          return (
            <li key={l.id} className={`rounded-xl border px-3 py-2 ${l.isError ? "border-amber-400 bg-amber-50" : "border-zinc-200 bg-zinc-50"}`}>
              <p className="flex flex-wrap items-baseline gap-x-2 text-sm">
                <span className="text-zinc-500">{i + 1}.</span>
                <span aria-hidden="true">{icon}</span>
                <code className="font-semibold text-teal-900">{l.name}</code>
                <span className="text-zinc-700">{l.request ?? (l.phase === "started" ? l.summary : "")}</span>
              </p>
              {l.phase === "finished" && <p className={`mt-1 text-sm ${l.isError ? "text-amber-950" : "text-zinc-900"}`}>{l.summary}</p>}
            </li>
          );
        })}
        {running && (
          <li role="status" className="px-3 py-2 text-sm text-zinc-600">
            ⏳ Thinking…
          </li>
        )}
      </ol>
      {agentText && !running && (
        <p className="mt-3 rounded-xl bg-violet-50 p-3 text-sm text-violet-950">
          <span className="font-semibold">Agent says:</span> {agentText}
        </p>
      )}
    </Card>
  );
}
