"use client";
import { useState } from "react";
import type { SchemeView } from "@/core/catalog";
import { blankDoc, isDocAdded, removeDoc, upsertDoc } from "@/core/flow";
import type { SampleSet } from "@/core/samples";
import { ExtractedDoc, type DocType } from "@/core/types";
import { STRINGS, docTitle, pick, type Lang } from "@/i18n";
import { fileToJpegDataUrl } from "./image";
import { Badge, Card, btn } from "./ui";

export function DocsStep({
  lang,
  scheme,
  docs,
  samples,
  aiOff,
  onAiOff,
  onDocs,
  onSample,
  onNext,
}: {
  lang: Lang;
  scheme: SchemeView;
  docs: ExtractedDoc[];
  samples: SampleSet[];
  aiOff: boolean;
  onAiOff: () => void;
  onDocs: (docs: ExtractedDoc[]) => void;
  onSample: (sample: SampleSet) => void;
  onNext: () => void;
}) {
  const t = STRINGS[lang];
  const [busy, setBusy] = useState<DocType | null>(null);
  const [failed, setFailed] = useState<DocType | null>(null);
  // `started`: the slot has a document (maybe still empty). `added`: it counts (its main field has a value).
  const docOf = (d: DocType) => docs.find((x) => x.docType === d);
  const missingRequired = scheme.slots.filter((s) => {
    const doc = docOf(s.docType);
    return s.required && !(doc && isDocAdded(doc));
  }).length;

  async function readPhoto(docType: DocType, file: File) {
    setBusy(docType);
    setFailed(null);
    let doc: ExtractedDoc = blankDoc(docType);
    try {
      const image = await fileToJpegDataUrl(file);
      const res = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image, docType }),
      });
      const data: unknown = await res.json();
      const parsed = ExtractedDoc.safeParse((data as { doc?: unknown })?.doc);
      if (res.ok && parsed.success) doc = parsed.data;
      else if ((data as { error?: unknown })?.error === "ai_unavailable") onAiOff();
      else setFailed(docType);
    } catch {
      setFailed(docType);
    } finally {
      // Whatever happened, the user can now check or type the details on the next screen.
      onDocs(upsertDoc(docs, doc));
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-base text-zinc-700">{t.docs.intro}</p>
      {aiOff && (
        <p role="status" className="rounded-xl bg-amber-50 p-3 text-amber-950">
          {t.docs.aiUnavailable}
        </p>
      )}

      <ul className="flex flex-col gap-3">
        {scheme.slots.map((slot) => {
          const doc = docOf(slot.docType);
          const started = doc !== undefined;
          const added = doc !== undefined && isDocAdded(doc);
          return (
            <li key={slot.docType}>
              <Card className={added ? "border-green-600" : started ? "border-amber-500" : ""}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-lg font-semibold">{docTitle(lang, slot.docType)}</h2>
                  <Badge tone={slot.required ? "teal" : "zinc"}>{slot.required ? t.docs.required : t.docs.optional}</Badge>
                </div>
                <p className={`mt-1 text-sm font-medium ${added ? "text-green-800" : started ? "text-amber-900" : "text-zinc-600"}`}>
                  {added ? `✓ ${t.docs.added}` : started ? `✏️ ${t.docs.toType}` : t.docs.notAdded}
                </p>
                {busy === slot.docType ? (
                  <p role="status" className="mt-3 text-base">
                    ⏳ {t.docs.reading}
                  </p>
                ) : (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <label className={`${btn.secondary} cursor-pointer`}>
                      📷 {t.docs.photo}
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        className="sr-only"
                        disabled={busy !== null}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          e.target.value = "";
                          if (file) void readPhoto(slot.docType, file);
                        }}
                      />
                    </label>
                    {started ? (
                      <button type="button" className={btn.quiet} onClick={() => onDocs(removeDoc(docs, slot.docType))}>
                        {t.docs.remove}
                      </button>
                    ) : (
                      <button type="button" className={btn.quiet} onClick={() => onDocs(upsertDoc(docs, blankDoc(slot.docType)))}>
                        ✏️ {t.docs.type}
                      </button>
                    )}
                  </div>
                )}
                {failed === slot.docType && (
                  <p role="alert" className="mt-2 text-sm text-red-800">
                    {t.docs.aiFailed}
                  </p>
                )}
              </Card>
            </li>
          );
        })}
      </ul>
      <p className="text-sm text-zinc-600">🔒 {t.docs.privacy}</p>

      {samples.length > 0 && (
        <Card className="border-dashed border-violet-400 bg-violet-50/50">
          <h2 className="text-lg font-semibold">{t.docs.samplesTitle}</h2>
          <ul className="mt-2 flex flex-col gap-2">
            {samples.map((s) => (
              <li key={s.id}>
                <button type="button" className={`${btn.secondary} w-full justify-start text-left`} onClick={() => onSample(s)}>
                  🧪 {pick(lang, s.titleEn, s.titleAs)}
                </button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {missingRequired > 0 && <p className="text-sm text-amber-900">{t.docs.missingRequired(missingRequired)}</p>}
      <button type="button" className={btn.primary} onClick={onNext} disabled={busy !== null}>
        {t.next} →
      </button>
    </div>
  );
}
