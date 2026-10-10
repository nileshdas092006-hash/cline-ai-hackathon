import { benefitView } from "@/core/reportView";
import type { Report } from "@/core/types";
import { STRINGS, pick, type Lang } from "@/i18n";
import { Card } from "./ui";

/** Central share and state top-up shown separately; no total unless the top-up is confirmed. */
export function BenefitCard({ lang, report }: { lang: Lang; report: Report }) {
  const t = STRINGS[lang].report;
  const b = benefitView(report.benefit);
  const period = b.period === "month" ? t.perMonth : t.perYear;
  return (
    <Card>
      <h2 className="text-lg font-semibold">💰 {t.benefitTitle}</h2>
      <dl className="mt-2 grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 text-base">
        <dt>{t.central}</dt>
        <dd className="text-right font-semibold">
          {b.central} {period}
        </dd>
        {b.stateTopUp === null ? (
          <dd className="col-span-2 text-amber-900">{t.confirmLocally}</dd>
        ) : (
          <>
            <dt>{t.stateTopUp}</dt>
            <dd className="text-right font-semibold">
              {b.stateTopUp} {period}
            </dd>
          </>
        )}
        {b.total !== null && (
          <>
            <dt className="border-t border-zinc-200 pt-1 font-semibold">{t.total}</dt>
            <dd className="border-t border-zinc-200 pt-1 text-right font-bold">
              {b.total} {period}
              {b.instalments ? ` (${t.instalments(b.instalments)})` : ""}
            </dd>
          </>
        )}
      </dl>
      {b.isOverride && (b.noteEn || b.noteAs) && (
        <p className="mt-2 text-sm text-violet-900">{pick(lang, b.noteEn ?? "", b.noteAs ?? "")}</p>
      )}
    </Card>
  );
}
