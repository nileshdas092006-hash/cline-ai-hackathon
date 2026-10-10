// One proposed (or past) rule version: summary, readable before/after diff, test results, and
// Publish / Reject while it is still proposed.
import { changeLabel, formatValue } from "@/core/ruleDiffView";
import { Badge, Card, btn } from "../_components/ui";

export interface Proposal {
  id: number;
  schemeId: string;
  version: string;
  previousVersion: string | null;
  nameEn: string;
  status: "proposed" | "published" | "rejected";
  sourceNote: string;
  summary: string;
  createdAt: string;
  approvedAt: string | null;
  changes: { path: string; kind: "added" | "removed" | "changed"; before?: unknown; after?: unknown }[];
  testResult: {
    total: number;
    passed: number;
    failed: number;
    results: { id: string; description: string; origin: "new" | "regression"; passed: boolean; failures: string[] }[];
  };
}

const STATUS_TONE = { proposed: "amber", published: "green", rejected: "zinc" } as const;
const KIND_STYLE = { added: "border-green-600 bg-green-50", removed: "border-red-600 bg-red-50", changed: "border-amber-500 bg-amber-50" } as const;

export function ProposalCard({ proposal: p, onDecide, compact = false }: { proposal: Proposal; onDecide: (id: number, d: "publish" | "reject") => void; compact?: boolean }) {
  const newTests = p.testResult.results.filter((r) => r.origin === "new");
  const regression = p.testResult.results.filter((r) => r.origin === "regression");
  const allPass = p.testResult.failed === 0;
  return (
    <Card className={compact ? "" : "border-2 border-teal-600"}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">
          {p.nameEn} <span className="font-mono text-base text-zinc-600">{p.previousVersion ? `${p.previousVersion} → ${p.version}` : `new · ${p.version}`}</span>
        </h2>
        <Badge tone={STATUS_TONE[p.status]}>{p.status}</Badge>
      </div>
      <p className="mt-1 text-zinc-800">{p.summary}</p>
      <p className="mt-1 text-sm text-zinc-600">Source: {p.sourceNote}</p>

      <h3 className="mt-4 font-semibold">What changes ({p.changes.length})</h3>
      <ul className="mt-2 flex flex-col gap-2">
        {p.changes.map((c) => (
          <li key={`${c.kind}-${c.path}`} className={`rounded-xl border-l-4 px-3 py-2 text-sm ${KIND_STYLE[c.kind]}`}>
            <p className="font-semibold">
              {c.kind === "added" ? "➕" : c.kind === "removed" ? "➖" : "✏️"} {changeLabel(c.path)}
            </p>
            {c.kind !== "added" && (
              <p className="mt-0.5 text-zinc-700">
                <span className="font-medium">Before:</span> <s>{formatValue(c.before)}</s>
              </p>
            )}
            {c.kind !== "removed" && (
              <p className="mt-0.5 text-zinc-900">
                <span className="font-medium">After:</span> {formatValue(c.after)}
              </p>
            )}
          </li>
        ))}
      </ul>

      <h3 className="mt-4 font-semibold">
        Tests: {allPass ? "✅" : "❌"} {p.testResult.passed} passed, {p.testResult.failed} failed
      </h3>
      <TestList title={`New tests written by the agent (${newTests.length})`} rows={newTests} open />
      <TestList title={`Regression tests: existing behaviour (${regression.length})`} rows={regression} open={!compact} />

      {p.status === "proposed" && (
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" className={btn.primary} disabled={!allPass} onClick={() => onDecide(p.id, "publish")}>
            ✅ Publish {p.version}
          </button>
          <button type="button" className={btn.secondary} onClick={() => onDecide(p.id, "reject")}>
            ✖ Reject
          </button>
        </div>
      )}
      {p.approvedAt && <p className="mt-2 text-sm text-zinc-600">Decided {new Date(p.approvedAt).toLocaleString()}</p>}
    </Card>
  );
}

function TestList({ title, rows, open }: { title: string; rows: Proposal["testResult"]["results"]; open: boolean }) {
  return (
    <details className="mt-2" open={open}>
      <summary className="cursor-pointer text-sm font-medium text-zinc-800">{title}</summary>
      <ul className="mt-1 flex flex-col gap-1">
        {rows.map((r) => (
          <li key={`${r.origin}-${r.id}`} className="text-sm">
            <span aria-label={r.passed ? "passed" : "failed"}>{r.passed ? "✓" : "✗"}</span> <code className="text-zinc-600">{r.id}</code> {r.description}
            {!r.passed && <span className="block pl-5 text-red-800">{r.failures.join("; ")}</span>}
          </li>
        ))}
      </ul>
    </details>
  );
}
