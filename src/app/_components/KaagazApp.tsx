"use client";
// The one main flow: scheme → documents → confirm fields → questions → two-verdict report.
// The browser never decides anything: the report comes from /api/check (the rule engine).
import { useEffect, useRef, useState } from "react";
import { APP_NAME, APP_NAME_AS, APP_TAGLINE_AS, APP_TAGLINE_EN } from "@/core/appInfo";
import type { SchemeView } from "@/core/catalog";
import { relevantAnswers } from "@/core/flow";
import type { SampleSet } from "@/core/samples";
import { Report, type Answers, type ExtractedDoc } from "@/core/types";
import { DEFAULT_LANG, STRINGS, type Lang } from "@/i18n";
import { ConfirmStep } from "./ConfirmStep";
import { CoverSheet } from "./CoverSheet";
import { DocsStep } from "./DocsStep";
import { QuestionsStep } from "./QuestionsStep";
import { ReportStep, type ReportState } from "./ReportStep";
import { SchemeStep } from "./SchemeStep";
import { DemoLabel, btn } from "./ui";

const STEPS = ["scheme", "docs", "confirm", "questions", "report"] as const;
type Step = (typeof STEPS)[number];
const BACK: Partial<Record<Step, Step>> = { docs: "scheme", confirm: "docs", questions: "confirm", report: "questions" };

export function KaagazApp({ catalog, samples }: { catalog: SchemeView[]; samples: SampleSet[] }) {
  const [lang, setLang] = useState<Lang>(DEFAULT_LANG);
  const [step, setStep] = useState<Step>("scheme");
  const [schemeId, setSchemeId] = useState<string | null>(null);
  const [docs, setDocs] = useState<ExtractedDoc[]>([]);
  const [answers, setAnswers] = useState<Answers>({});
  const [sampleId, setSampleId] = useState<SampleSet["id"] | null>(null);
  const [aiOff, setAiOff] = useState(false);
  const [reportState, setReportState] = useState<ReportState>({ status: "idle" });
  const headingRef = useRef<HTMLHeadingElement>(null);
  const requestId = useRef(0);
  const firstRender = useRef(true);

  const t = STRINGS[lang];
  const scheme = catalog.find((s) => s.id === schemeId) ?? null;
  const stepNo = STEPS.indexOf(step) + 1;

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  useEffect(() => {
    // Move focus to the new screen's heading (screen readers), but not on first load.
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    window.scrollTo({ top: 0 });
    headingRef.current?.focus({ preventScroll: true });
  }, [step]);

  function reset() {
    requestId.current++;
    setDocs([]);
    setAnswers({});
    setSampleId(null);
    setReportState({ status: "idle" });
  }

  function chooseScheme(id: string) {
    if (id !== schemeId) {
      reset();
      setSchemeId(id);
    }
    setStep("docs");
  }

  function chooseSample(sample: SampleSet) {
    reset();
    setSchemeId(sample.schemeId);
    setDocs(sample.docs);
    setAnswers(sample.answers);
    setSampleId(sample.id);
    setStep("confirm");
  }

  function startOver() {
    reset();
    setSchemeId(null);
    setStep("scheme");
  }

  async function runCheck() {
    if (!scheme) return;
    const id = ++requestId.current;
    setStep("report");
    setReportState({ status: "loading" });
    try {
      const res = await fetch("/api/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          schemeId: scheme.id,
          schemeVersion: scheme.version,
          docs,
          answers: relevantAnswers(scheme.questions, answers),
        }),
      });
      const parsed = Report.safeParse(await res.json());
      if (id !== requestId.current) return;
      setReportState(res.ok && parsed.success ? { status: "done", report: parsed.data } : { status: "error" });
    } catch {
      if (id === requestId.current) setReportState({ status: "error" });
    }
  }

  const titles: Record<Step, string> = {
    scheme: t.scheme.title,
    docs: t.docs.title,
    confirm: t.confirm.title,
    questions: t.questions.title,
    report: scheme ? (lang === "as" ? scheme.nameAs : scheme.nameEn) : "",
  };
  const backTo = BACK[step];
  const report = reportState.status === "done" ? reportState.report : null;

  return (
    <>
      <div className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-4 px-4 pb-10 pt-4 print:hidden">
        <header className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xl font-bold leading-tight">
              <span lang="en">{APP_NAME}</span> · {APP_NAME_AS}
            </p>
            <p className="text-sm text-zinc-600">{lang === "as" ? APP_TAGLINE_AS : APP_TAGLINE_EN}</p>
          </div>
          <button
            type="button"
            className={btn.secondary}
            onClick={() => setLang(lang === "as" ? "en" : "as")}
            aria-label={t.langToggleAria}
            lang={lang === "as" ? "en" : "as"}
          >
            {t.langToggle}
          </button>
        </header>

        <div>
          <p className="text-sm font-medium text-zinc-600">{t.stepOf(stepNo, STEPS.length)}</p>
          <div className="mt-1 h-2 rounded-full bg-zinc-200" aria-hidden="true">
            <div className="h-2 rounded-full bg-teal-600 transition-all" style={{ width: `${(stepNo / STEPS.length) * 100}%` }} />
          </div>
        </div>

        {sampleId && <DemoLabel text={`${t.demoMode} (${sampleId})`} />}

        <main className="flex flex-col gap-4">
          <h1 ref={headingRef} tabIndex={-1} className="text-2xl font-bold leading-snug outline-none">
            {titles[step]}
          </h1>

          {step === "scheme" && <SchemeStep lang={lang} catalog={catalog} selected={schemeId} onChoose={chooseScheme} />}
          {step === "docs" && scheme && (
            <DocsStep
              lang={lang}
              scheme={scheme}
              docs={docs}
              samples={samples.filter((s) => s.schemeId === scheme.id)}
              aiOff={aiOff}
              onAiOff={() => setAiOff(true)}
              onDocs={setDocs}
              onSample={chooseSample}
              onNext={() => setStep("confirm")}
            />
          )}
          {step === "confirm" && scheme && (
            <ConfirmStep lang={lang} docs={docs} onDocs={setDocs} onNext={() => setStep("questions")} />
          )}
          {step === "questions" && scheme && (
            <QuestionsStep lang={lang} questions={scheme.questions} answers={answers} onAnswers={setAnswers} onNext={runCheck} />
          )}
          {step === "report" && scheme && (
            <ReportStep lang={lang} scheme={scheme} state={reportState} onRetry={runCheck} onStartOver={startOver} />
          )}

          {backTo && (
            <button type="button" className={`${btn.quiet} self-start`} onClick={() => setStep(backTo)}>
              ← {t.back}
            </button>
          )}
        </main>
      </div>
      {report && scheme && <CoverSheet lang={lang} scheme={scheme} report={report} docs={docs} sampleId={sampleId} />}
    </>
  );
}

