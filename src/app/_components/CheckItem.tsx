import type { Check } from "@/core/types";
import { STRINGS, fixWhereLabel, pick, type Lang } from "@/i18n";
import { Badge } from "./ui";

/** One check: reason, where to fix it, source link with "verified on" date, provisional badge. */
export function CheckItem({ lang, check }: { lang: Lang; check: Check }) {
  const t = STRINGS[lang].report;
  const p = check.provenance;
  return (
    <li className="flex flex-col gap-1 border-t border-zinc-200 py-3 first:border-t-0">
      <p className="text-base leading-relaxed">{pick(lang, check.messageEn, check.messageAs)}</p>
      {check.fixWhere !== "none" && (
        <p className="text-sm">
          <span className="font-semibold">📍 {t.where}: </span>
          {fixWhereLabel(lang, check.fixWhere)}
        </p>
      )}
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-zinc-600">
        <span className="font-semibold">{t.source}:</span>
        {p.sourceUrl ? (
          <a href={p.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-teal-800 underline underline-offset-2">
            {p.sourceTitle}
          </a>
        ) : (
          <span>
            {p.sourceTitle} ({t.noSourceLink})
          </span>
        )}
        <span>· {t.verifiedOn(p.verifiedOn)}</span>
        {p.status === "provisional" && <Badge tone="amber">{t.provisional}</Badge>}
      </p>
    </li>
  );
}
