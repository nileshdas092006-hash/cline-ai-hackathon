"use client";
import type { SchemeView } from "@/core/catalog";
import { sectionsOf, toneOf } from "@/core/reportView";
import type { Report } from "@/core/types";
import { STRINGS, pick, type Lang } from "@/i18n";
import { BenefitCard } from "./BenefitCard";
import { CheckItem } from "./CheckItem";
import { Badge, Card, VerdictBanner, btn } from "./ui";

export type ReportState = { status: "idle" } | { status: "loading" } | { status: "error" } | { status: "done"; report: Report };

export function ReportStep({
  lang,
  scheme,
  state,
  onRetry,
  onStartOver,
}: {
  lang: Lang;
  scheme: SchemeView;
  state: ReportState;
  onRetry: () => void;
  onStartOver: () => void;
}) {
  const t = STRINGS[lang].report;
  if (state.status === "error") {
    return (
      <div role="alert" className="flex flex-col gap-3">
        <p className="text-base text-red-800">{t.error}</p>
        <button type="button" className={btn.primary} onClick={onRetry}>
          ↻ {STRINGS[lang].questions.seeResult}
        </button>
      </div>
    );
  }
  if (state.status !== "done") {
    return (
      <p role="status" className="text-lg">
        ⏳ {t.checking}
      </p>
    );
  }

  const r = state.report;
  const s = sectionsOf(r);
  const externalLabel = (checkId: string) => {
    const e = scheme.external.find((x) => x.checkId === checkId);
    return e ? pick(lang, e.labelEn, e.labelAs) : checkId;
  };

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-zinc-600">
        {t.asOf(r.asOfDate)} · {t.ruleVersion(r.schemeVersion)}
      </p>

      <VerdictBanner title={t.eligibilityTitle} label={t.eligibility[r.eligibility]} tone={toneOf(r.eligibility)} />
      <VerdictBanner title={t.readinessTitle} label={t.readiness[r.readiness]} tone={toneOf(r.readiness)}>
        {s.external.length > 0 && (
          <div className="mt-3">
            <p className="text-sm font-semibold">🏦 {t.checkAtBank}:</p>
            <ul className="mt-1 list-disc pl-6 text-base">
              {s.external.map((c) => (
                <li key={c.id}>{externalLabel(c.id)}</li>
              ))}
            </ul>
          </div>
        )}
      </VerdictBanner>

      <Card className="border-red-300">
        <h2 className="text-lg font-bold text-red-900">🔴 {t.fixTitle}</h2>
        {s.fix.length === 0 ? (
          <p className="mt-1 text-base text-zinc-700">{t.nothingToFix}</p>
        ) : (
          <ul className="mt-1">
            {s.fix.map((c) => (
              <CheckItem key={c.id} lang={lang} check={c} />
            ))}
          </ul>
        )}
      </Card>

      {s.verify.length > 0 && (
        <Card className="border-amber-300">
          <h2 className="text-lg font-bold text-amber-900">🟡 {t.verifyTitle}</h2>
          <ul className="mt-1">
            {s.verify.map((c) => (
              <CheckItem key={c.id} lang={lang} check={c} />
            ))}
          </ul>
        </Card>
      )}

      {s.ok.length > 0 && (
        <details className="rounded-2xl border border-green-300 bg-white p-4 shadow-sm">
          <summary className="cursor-pointer text-lg font-bold text-green-900">🟢 {t.okTitle(s.ok.length)}</summary>
          <ul className="mt-1">
            {s.ok.map((c) => (
              <CheckItem key={c.id} lang={lang} check={c} />
            ))}
          </ul>
        </details>
      )}

      <BenefitCard lang={lang} report={r} />

      {r.supportingDocs.length > 0 && (
        <Card>
          <h2 className="text-lg font-semibold">{t.supportingTitle}</h2>
          {(r.supportingDocsNoteEn || r.supportingDocsNoteAs) && (
            <p className="mt-1 text-sm text-zinc-600">{pick(lang, r.supportingDocsNoteEn ?? "", r.supportingDocsNoteAs ?? "")}</p>
          )}
          <ul className="mt-2 flex flex-col gap-1">
            {r.supportingDocs.map((d) => (
              <li key={d.docType} className="flex items-center justify-between gap-2 text-base">
                <span>{pick(lang, d.labelEn, d.labelAs)}</span>
                <Badge tone={d.present ? "green" : "zinc"}>{d.present ? t.present : t.absent}</Badge>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="flex flex-col gap-2 sm:flex-row">
        <button type="button" className={btn.primary} onClick={() => window.print()}>
          🖨️ {t.print}
        </button>
        <button type="button" className={btn.secondary} onClick={onStartOver}>
          {STRINGS[lang].startOver}
        </button>
      </div>

      <footer className="rounded-xl bg-zinc-100 p-3 text-sm text-zinc-800">
        <p lang="as">{r.disclaimerAs}</p>
        <p lang="en" className="mt-1">
          {r.disclaimerEn}
        </p>
      </footer>
    </div>
  );
}
