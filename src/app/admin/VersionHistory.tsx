// Version history per scheme: the live version, the built-in pack, and every proposal (newest first).
import { Badge, Card } from "../_components/ui";
import { ProposalCard, type Proposal } from "./ProposalCard";

export interface SchemeHistory {
  id: string;
  nameEn: string;
  liveVersion: string | null;
  builtinVersion: string | null;
  versions: Proposal[];
}

export function VersionHistory({ schemes, onDecide }: { schemes: SchemeHistory[]; onDecide: (id: number, d: "publish" | "reject") => void }) {
  if (schemes.length === 0) return null;
  return (
    <section className="flex flex-col gap-3" aria-labelledby="history-title">
      <h2 id="history-title" className="text-xl font-bold">
        Version history
      </h2>
      {schemes.map((s) => (
        <Card key={s.id}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-lg font-semibold">{s.nameEn}</h3>
            {s.liveVersion && <Badge tone="green">live: {s.liveVersion}</Badge>}
          </div>
          <ul className="mt-2 flex flex-col gap-2">
            {s.versions.map((v) => (
              <li key={v.id}>
                <details>
                  <summary className="cursor-pointer text-base">
                    <span className="font-mono">{v.version}</span> · {v.status} · {new Date(v.createdAt).toLocaleString()} · {v.summary.slice(0, 80)}
                  </summary>
                  <div className="mt-2">
                    <ProposalCard proposal={v} onDecide={onDecide} compact />
                  </div>
                </details>
              </li>
            ))}
            {s.builtinVersion && (
              <li className="text-base text-zinc-700">
                <span className="font-mono">{s.builtinVersion}</span> · built-in (version 1, in code)
              </li>
            )}
          </ul>
        </Card>
      ))}
    </section>
  );
}
