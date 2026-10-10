"use client";
// Paste a rejection message → /api/decode → one known reason + fixed steps, or "needs verification"
// + what to ask at the office. The browser decides nothing: it only shows the server's result.
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { APP_NAME, APP_NAME_AS } from "@/core/appInfo";
import { MAX_DECODE_CHARS, type DecodeResult } from "@/core/decode";
import { DEFAULT_LANG, STRINGS, type Lang } from "@/i18n";
import { Card, btn } from "../_components/ui";
import { DecodeAnswer, type AiStatus } from "./DecodeAnswer";

type State = { status: "idle" } | { status: "loading" } | { status: "error" } | { status: "done"; result: DecodeResult; ai: AiStatus };

export function DecodeApp() {
  const [lang, setLang] = useState<Lang>(DEFAULT_LANG);
  const [text, setText] = useState("");
  const [state, setState] = useState<State>({ status: "idle" });
  const resultRef = useRef<HTMLDivElement>(null);
  const t = STRINGS[lang];
  const d = t.decode;

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  useEffect(() => {
    if (state.status === "done") resultRef.current?.focus();
  }, [state.status]);

  async function decode() {
    setState({ status: "loading" });
    try {
      const res = await fetch("/api/decode", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }) });
      const body = (await res.json()) as { result?: DecodeResult; ai?: AiStatus };
      if (!res.ok || !body.result || !body.ai) {
        setState({ status: "error" });
        return;
      }
      setState({ status: "done", result: body.result, ai: body.ai });
    } catch {
      setState({ status: "error" });
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-4 px-4 pb-10 pt-4">
      <header className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xl font-bold leading-tight">
            <span lang="en">{APP_NAME}</span> · {APP_NAME_AS}
          </p>
          <Link href="/" className="inline-flex min-h-12 items-center text-base text-teal-800 underline underline-offset-2">
            ← {d.back}
          </Link>
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

      <main className="flex flex-col gap-4">
        <h1 className="text-2xl font-bold leading-snug">{d.title}</h1>
        <p className="text-base text-zinc-700">{d.intro}</p>

        <Card>
          <form
            className="flex flex-col gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (text.trim() && state.status !== "loading") void decode();
            }}
          >
            <label htmlFor="rejection-text" className="text-lg font-semibold">
              {d.label}
            </label>
            <textarea
              id="rejection-text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={5}
              maxLength={MAX_DECODE_CHARS}
              placeholder={d.placeholder}
              className="w-full rounded-xl border-2 border-zinc-300 bg-white px-3 py-2 text-base focus-visible:outline-3 focus-visible:outline-teal-500"
            />
            <p className="text-sm text-zinc-600">🔒 {d.privacy}</p>
            <button type="submit" className={btn.primary} disabled={text.trim() === "" || state.status === "loading"}>
              {state.status === "loading" ? `⏳ ${d.working}` : `🔍 ${d.submit}`}
            </button>
          </form>
        </Card>

        {state.status === "error" && (
          <p role="alert" className="rounded-xl bg-red-50 p-3 text-base text-red-900">
            {d.error}
          </p>
        )}
        {state.status === "done" && (
          <div ref={resultRef} tabIndex={-1} aria-live="polite" className="flex flex-col gap-4 outline-none">
            <DecodeAnswer lang={lang} result={state.result} ai={state.ai} />
          </div>
        )}
      </main>
    </div>
  );
}
