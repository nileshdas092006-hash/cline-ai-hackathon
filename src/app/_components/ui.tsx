// Small shared UI pieces. Mobile-first: big touch targets (≥ 48px), visible focus rings.
import type { ReactNode } from "react";
import { TONE_EMOJI, type Tone } from "@/core/reportView";

export const btn = {
  primary:
    "inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-teal-700 px-5 py-3 text-base font-semibold text-white shadow-sm hover:bg-teal-800 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-teal-500 disabled:cursor-not-allowed disabled:opacity-50",
  secondary:
    "inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border-2 border-teal-700 bg-white px-4 py-2 text-base font-semibold text-teal-800 hover:bg-teal-50 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-teal-500 disabled:cursor-not-allowed disabled:opacity-50",
  quiet:
    "inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-3 py-2 text-base font-medium text-zinc-700 underline-offset-4 hover:underline focus-visible:outline-3 focus-visible:outline-teal-500",
};

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm ${className}`}>{children}</section>;
}

const BADGE_TONES = {
  teal: "bg-teal-100 text-teal-900",
  amber: "bg-amber-100 text-amber-900",
  zinc: "bg-zinc-100 text-zinc-800",
  green: "bg-green-100 text-green-900",
  violet: "bg-violet-100 text-violet-900",
};

export function Badge({ children, tone = "zinc" }: { children: ReactNode; tone?: keyof typeof BADGE_TONES }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-sm font-medium ${BADGE_TONES[tone]}`}>
      {children}
    </span>
  );
}

const BANNER_TONES: Record<Tone, string> = {
  green: "border-green-700 bg-green-50 text-green-950",
  red: "border-red-700 bg-red-50 text-red-950",
  yellow: "border-amber-600 bg-amber-50 text-amber-950",
  grey: "border-zinc-400 bg-zinc-50 text-zinc-900",
};

export function VerdictBanner({ title, label, tone, children }: { title: string; label: string; tone: Tone; children?: ReactNode }) {
  return (
    <section className={`rounded-2xl border-l-8 p-4 ${BANNER_TONES[tone]}`} aria-label={`${title}: ${label}`}>
      <p className="text-sm font-semibold uppercase tracking-wide opacity-80">{title}</p>
      <p className="mt-1 flex items-center gap-2 text-2xl font-bold">
        <span aria-hidden="true">{TONE_EMOJI[tone]}</span>
        {label}
      </p>
      {children}
    </section>
  );
}

export function DemoLabel({ text }: { text: string }) {
  return (
    <p role="note" className="rounded-xl border-2 border-dashed border-violet-500 bg-violet-50 px-3 py-2 text-center text-sm font-semibold text-violet-900">
      🧪 {text}
    </p>
  );
}
