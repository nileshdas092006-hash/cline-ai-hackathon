// The decoder's answer: reason (or "needs verification"), fixed steps, where to go, what to ask.
// Every text comes from code (rejectionCodes.ts / decode.ts / i18n.ts), never from the model.
import type { DecodeResult } from "@/core/decode";
import { STRINGS, fixWhereLabel, pick, type Lang } from "@/i18n";
import { Card, VerdictBanner } from "../_components/ui";

export type AiStatus = "ok" | "ai_unavailable" | "ai_failed";

export function DecodeAnswer({ lang, result: r, ai }: { lang: Lang; result: DecodeResult; ai: AiStatus }) {
  const d = STRINGS[lang].decode;
  const matched = r.status === "matched";
  const other: Lang = lang === "as" ? "en" : "as";
  return (
    <>
      <VerdictBanner
        title={matched ? d.matched : d.needsVerification}
        label={matched ? pick(lang, r.fix.titleEn, r.fix.titleAs) : d.needsVerificationNote}
        tone={matched ? "green" : "yellow"}
      >
        {r.confidence !== null && <p className="mt-1 text-sm">{d.confidence(Math.round(r.confidence * 100))}</p>}
        {ai !== "ok" && <p className="mt-1 text-sm">{d.aiOff}</p>}
        {r.possible && <p className="mt-2 text-base">{d.possibly(pick(lang, r.possible.titleEn, r.possible.titleAs))}</p>}
      </VerdictBanner>

      <Card>
        <h2 className="text-lg font-bold">{d.steps}</h2>
        <ol className="mt-2 list-decimal pl-6 text-base leading-relaxed">
          {(lang === "as" ? r.fix.stepsAs : r.fix.stepsEn).map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ol>
        <p className="mt-2 text-sm">
          <span className="font-semibold">📍 {d.where}: </span>
          {fixWhereLabel(lang, r.fix.fixWhere)}
        </p>
        <details className="mt-2" lang={other}>
          <summary className="cursor-pointer text-sm font-medium text-zinc-700">{STRINGS[other].decode.steps}</summary>
          <ol className="mt-1 list-decimal pl-6 text-sm">
            {(other === "as" ? r.fix.stepsAs : r.fix.stepsEn).map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ol>
        </details>
      </Card>

      {r.ask.length > 0 && (
        <Card className="border-amber-300">
          <h2 className="text-lg font-bold text-amber-900">❓ {d.ask}</h2>
          <ul className="mt-2 flex flex-col gap-2 text-base">
            {r.ask.map((q) => (
              <li key={q.en}>
                <p>{pick(lang, q.en, q.as)}</p>
                <p className="text-sm text-zinc-600" lang={other}>
                  {pick(other, q.en, q.as)}
                </p>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <footer className="rounded-xl bg-zinc-100 p-3 text-sm text-zinc-800">
        <p lang="as">{STRINGS.as.decode.disclaimer}</p>
        <p lang="en" className="mt-1">
          {STRINGS.en.decode.disclaimer}
        </p>
      </footer>
    </>
  );
}
