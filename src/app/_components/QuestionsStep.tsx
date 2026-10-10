"use client";
import type { Answers, Question } from "@/core/types";
import { STRINGS, pick, type Lang } from "@/i18n";
import { Badge, Card, btn } from "./ui";

export function QuestionsStep({
  lang,
  questions,
  answers,
  onAnswers,
  onNext,
}: {
  lang: Lang;
  questions: Question[];
  answers: Answers;
  onAnswers: (a: Answers) => void;
  onNext: () => void;
}) {
  const t = STRINGS[lang];
  const answered = questions.filter((q) => answers[q.id] !== undefined).length;

  return (
    <div className="flex flex-col gap-4">
      <p className="text-base font-medium text-zinc-700" role="status">
        {t.questions.answered(answered, questions.length)}
      </p>
      <ol className="flex flex-col gap-3">
        {questions.map((q, i) => {
          const a = answers[q.id];
          const choice = (value: boolean, label: string) => (
            <button
              type="button"
              aria-pressed={a === value}
              onClick={() => onAnswers({ ...answers, [q.id]: value })}
              className={`min-h-14 flex-1 rounded-xl border-2 px-4 text-xl font-bold focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-teal-500 ${
                a === value ? "border-teal-700 bg-teal-700 text-white" : "border-zinc-300 bg-white text-zinc-900 hover:border-teal-600"
              }`}
            >
              {label}
            </button>
          );
          return (
            <li key={q.id}>
              <Card>
                <fieldset>
                  <legend className="text-lg font-medium leading-snug">
                    <span className="text-zinc-500">{i + 1}. </span>
                    {pick(lang, q.textEn, q.textAs)}
                  </legend>
                  {q.provenance.status === "provisional" && (
                    <p className="mt-1">
                      <Badge tone="amber">{t.questions.provisional}</Badge>
                    </p>
                  )}
                  <div className="mt-3 flex gap-3">
                    {choice(true, t.questions.yes)}
                    {choice(false, t.questions.no)}
                  </div>
                </fieldset>
              </Card>
            </li>
          );
        })}
      </ol>
      {answered < questions.length && <p className="text-sm text-zinc-600">{t.questions.unansweredNote}</p>}
      <button type="button" className={btn.primary} onClick={onNext}>
        {t.questions.seeResult} →
      </button>
    </div>
  );
}
