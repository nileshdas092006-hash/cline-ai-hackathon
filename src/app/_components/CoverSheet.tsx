// Printed instead of the app (window.print()). Plain, black-on-white, both verdicts + what to do.
// Shows no full Aadhaar number (only XXXX XXXX 1234) and no bank account number.
import { maskAadhaar } from "@/core/aadhaar";
import { APP_NAME, APP_NAME_AS } from "@/core/appInfo";
import type { SchemeView } from "@/core/catalog";
import { sectionsOf, TONE_EMOJI, toneOf } from "@/core/reportView";
import type { SampleSet } from "@/core/samples";
import type { ExtractedDoc, Report } from "@/core/types";
import { STRINGS, docTitle, fixWhereLabel, pick, type Lang } from "@/i18n";

export function CoverSheet({
  lang,
  scheme,
  report,
  docs,
  sampleId,
}: {
  lang: Lang;
  scheme: SchemeView;
  report: Report;
  docs: ExtractedDoc[];
  sampleId: SampleSet["id"] | null;
}) {
  const t = STRINGS[lang];
  const r = t.report;
  const s = sectionsOf(report);
  const applicant = docs.find((d) => d.fields.name)?.fields.name;
  const aadhaar = docs.find((d) => d.fields.aadhaarLast4)?.fields.aadhaarLast4;

  return (
    <article className="hidden p-8 text-black print:block">
      <header className="border-b-2 border-black pb-2">
        <p className="text-sm">
          {APP_NAME} · {APP_NAME_AS}
        </p>
        <h1 className="text-2xl font-bold">{r.coverTitle}</h1>
        <p className="text-lg">{pick(lang, scheme.nameEn, scheme.nameAs)}</p>
        <p className="text-sm">
          {r.asOf(report.asOfDate)} · {r.ruleVersion(report.schemeVersion)}
        </p>
        {sampleId && <p className="mt-1 font-bold">*** {t.demoMode} ({sampleId}) ***</p>}
      </header>

      {(applicant || aadhaar) && (
        <p className="mt-3">
          {applicant}
          {aadhaar ? ` · Aadhaar ${maskAadhaar(aadhaar)}` : ""}
        </p>
      )}

      <p className="mt-3 text-lg">
        <strong>{r.eligibilityTitle}:</strong> {TONE_EMOJI[toneOf(report.eligibility)]} {r.eligibility[report.eligibility]}
      </p>
      <p className="text-lg">
        <strong>{r.readinessTitle}:</strong> {TONE_EMOJI[toneOf(report.readiness)]} {r.readiness[report.readiness]}
      </p>

      <h2 className="mt-4 text-lg font-bold">{r.coverDocs}</h2>
      <p>{docs.map((d) => docTitle(lang, d.docType)).join(", ") || "-"}</p>

      {[
        { title: r.fixTitle, items: s.fix },
        { title: r.verifyTitle, items: s.verify },
      ].map(
        (sec) =>
          sec.items.length > 0 && (
            <section key={sec.title} className="mt-4">
              <h2 className="text-lg font-bold">{sec.title}</h2>
              <ol className="list-decimal pl-6">
                {sec.items.map((c) => (
                  <li key={c.id} className="mt-1">
                    {pick(lang, c.messageEn, c.messageAs)}
                    {c.fixWhere !== "none" && ` [${r.where}: ${fixWhereLabel(lang, c.fixWhere)}]`}
                    {c.provenance.status === "provisional" && ` (${r.provisional})`}
                  </li>
                ))}
              </ol>
            </section>
          ),
      )}

      <footer className="mt-6 border-t border-black pt-2 text-sm">
        <p>{report.disclaimerAs}</p>
        <p>{report.disclaimerEn}</p>
      </footer>
    </article>
  );
}
