"use client";
import type { SchemeView } from "@/core/catalog";
import { formatInr } from "@/core/reportView";
import { STRINGS, type Lang } from "@/i18n";
import { Badge } from "./ui";

export function SchemeStep({
  lang,
  catalog,
  selected,
  onChoose,
}: {
  lang: Lang;
  catalog: SchemeView[];
  selected: string | null;
  onChoose: (id: string) => void;
}) {
  const t = STRINGS[lang];
  return (
    <ul className="flex flex-col gap-3">
      {catalog.map((s) => {
        const b = s.benefit;
        const amount = b.centralShare + (b.stateTopUp ?? 0);
        const period = b.period === "month" ? t.report.perMonth : t.report.perYear;
        return (
          <li key={s.id}>
            <button
              type="button"
              onClick={() => onChoose(s.id)}
              aria-current={selected === s.id ? "true" : undefined}
              className={`flex w-full flex-col gap-1 rounded-2xl border-2 bg-white p-4 text-left shadow-sm hover:border-teal-600 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-teal-500 ${
                selected === s.id ? "border-teal-700" : s.flagship ? "border-teal-300" : "border-zinc-200"
              }`}
            >
              {s.flagship && (
                <span>
                  <Badge tone="teal">★ {t.scheme.flagship}</Badge>
                </span>
              )}
              <span className="text-lg font-semibold leading-snug">{lang === "as" ? s.nameAs : s.nameEn}</span>
              <span className="text-sm text-zinc-600" lang={lang === "as" ? "en" : "as"}>
                {lang === "as" ? s.nameEn : s.nameAs}
              </span>
              <span className="text-base text-zinc-800">
                {formatInr(amount)}
                {b.stateTopUp === null ? "+" : ""} {period}
              </span>
              <span className="mt-1 font-semibold text-teal-800">{t.scheme.choose} →</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
