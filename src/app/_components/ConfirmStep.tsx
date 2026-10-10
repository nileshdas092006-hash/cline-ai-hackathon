"use client";
import { useState } from "react";
import { DOC_FIELDS, confirmField, fieldText, needsConfirmation, setField, unconfirmedCount, upsertDoc } from "@/core/flow";
import type { ExtractedDoc, FieldName } from "@/core/types";
import { STRINGS, docTitle, type Lang } from "@/i18n";
import { Card, btn } from "./ui";

const HINTED = ["dob", "aadhaarLast4", "ownerNames"] as const;
const hasHint = (f: FieldName): f is (typeof HINTED)[number] => (HINTED as readonly string[]).includes(f);

export function ConfirmStep({
  lang,
  docs,
  onDocs,
  onNext,
}: {
  lang: Lang;
  docs: ExtractedDoc[];
  onDocs: (docs: ExtractedDoc[]) => void;
  onNext: () => void;
}) {
  const t = STRINGS[lang];
  // Raw text as typed, so parsing (e.g. Aadhaar → last 4 digits) never fights the cursor.
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const toCheck = unconfirmedCount(docs);

  function edit(doc: ExtractedDoc, field: FieldName, value: string) {
    setDrafts((d) => ({ ...d, [`${doc.docType}.${field}`]: value }));
    onDocs(upsertDoc(docs, setField(doc, field, value)));
  }

  if (docs.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-base text-zinc-700">{t.confirm.noDocs}</p>
        <button type="button" className={btn.primary} onClick={onNext}>
          {t.next} →
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-base text-zinc-700">{t.confirm.intro}</p>
      {docs.map((doc) => (
        <Card key={doc.docType}>
          <h2 className="text-lg font-semibold">{docTitle(lang, doc.docType)}</h2>
          {DOC_FIELDS[doc.docType].length === 0 && <p className="mt-1 text-sm text-green-800">✓ {t.docs.added}</p>}
          <div className="mt-2 flex flex-col gap-3">
            {DOC_FIELDS[doc.docType].map((field) => {
              const id = `f-${doc.docType}-${field}`;
              const unsure = needsConfirmation(doc, field);
              const value = drafts[`${doc.docType}.${field}`] ?? fieldText(doc, field);
              const hint = hasHint(field) ? t.fieldHints[field] : null;
              const common = {
                id,
                value,
                "aria-invalid": unsure || undefined,
                "aria-describedby": hint ? `${id}-hint` : undefined,
                className: `w-full rounded-xl border-2 px-3 py-2 text-lg focus-visible:outline-3 focus-visible:outline-teal-500 ${
                  unsure ? "border-amber-500 bg-amber-50" : "border-zinc-300 bg-white"
                }`,
              };
              return (
                <div key={field}>
                  <label htmlFor={id} className="flex flex-wrap items-center gap-2 text-base font-medium">
                    {t.fields[field]}
                    {unsure && <span className="rounded-full bg-amber-200 px-2 text-sm text-amber-950">⚠ {t.confirm.lowConfidence}</span>}
                  </label>
                  {field === "ownerNames" ? (
                    <textarea {...common} rows={2} onChange={(e) => edit(doc, field, e.target.value)} />
                  ) : (
                    <input
                      {...common}
                      type="text"
                      autoComplete="off"
                      inputMode={field === "aadhaarLast4" || field === "accountNo" ? "numeric" : undefined}
                      maxLength={field === "aadhaarLast4" ? 4 : undefined}
                      autoCapitalize={field === "ifsc" ? "characters" : undefined}
                      onChange={(e) => edit(doc, field, e.target.value)}
                    />
                  )}
                  {hint && (
                    <p id={`${id}-hint`} className="mt-1 text-sm text-zinc-600">
                      {hint}
                    </p>
                  )}
                  {unsure && value.trim() !== "" && (
                    <button type="button" className={`${btn.secondary} mt-2`} onClick={() => onDocs(upsertDoc(docs, confirmField(doc, field)))}>
                      ✓ {t.confirm.looksRight}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      ))}
      {toCheck > 0 && (
        <p role="status" className="text-base font-medium text-amber-900">
          {t.confirm.toCheck(toCheck)}
        </p>
      )}
      <button type="button" className={btn.primary} onClick={onNext}>
        {t.next} →
      </button>
    </div>
  );
}
