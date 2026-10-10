// Pure view-model helpers for the report screen: grouping, colours and money formatting.
// Grouping only re-arranges the engine's checks; it never changes a result.
import type { BenefitOn, Check, Eligibility, Readiness } from "./types";

export type Tone = "green" | "red" | "yellow" | "grey";

export const TONE_EMOJI: Record<Tone, string> = { green: "🟢", red: "🔴", yellow: "🟡", grey: "⚪" };

export function toneOf(verdict: Eligibility | Readiness): Tone {
  switch (verdict) {
    case "likely_eligible":
    case "ready_for_review":
      return "green";
    case "not_eligible":
    case "action_required":
      return "red";
    case "needs_verification":
      return "yellow";
  }
}

export interface ReportSections {
  /** action_required: fix these before applying. */
  fix: Check[];
  /** needs_verification: details first, then facts to confirm at the bank/office (external). */
  verify: Check[];
  /** The external checks (also inside `verify`), for the "confirm at the bank" list. */
  external: Check[];
  /** ok and not_applicable. */
  ok: Check[];
}

export function sectionsOf(report: { checks: readonly Check[] }): ReportSections {
  const checks = report.checks;
  const external = checks.filter((c) => c.kind === "external" && c.result === "needs_verification");
  return {
    fix: checks.filter((c) => c.result === "action_required"),
    verify: [...checks.filter((c) => c.result === "needs_verification" && c.kind !== "external"), ...external],
    external,
    ok: checks.filter((c) => c.result === "ok" || c.result === "not_applicable"),
  };
}

/** Indian digit grouping: 125000 → "₹1,25,000". Rounds to whole rupees. */
export function formatInr(amount: number): string {
  const neg = amount < 0;
  const digits = String(Math.round(Math.abs(amount)));
  const last3 = digits.slice(-3);
  const rest = digits.slice(0, -3);
  const grouped = rest === "" ? last3 : `${rest.replace(/\B(?=(\d{2})+(?!\d))/g, ",")},${last3}`;
  return `${neg ? "-" : ""}₹${grouped}`;
}

export interface BenefitView {
  central: string;
  /** null = unconfirmed ("confirm locally"). */
  stateTopUp: string | null;
  /** null whenever the state top-up is unconfirmed. */
  total: string | null;
  period: BenefitOn["period"];
  instalments?: number;
  isOverride: boolean;
  noteEn?: string;
  noteAs?: string;
}

export function benefitView(b: BenefitOn): BenefitView {
  return {
    central: formatInr(b.centralShare),
    stateTopUp: b.stateTopUp === null ? null : formatInr(b.stateTopUp),
    total: b.total === null ? null : formatInr(b.total),
    period: b.period,
    ...(b.instalments !== undefined ? { instalments: b.instalments } : {}),
    isOverride: b.isOverride,
    ...(b.noteEn ? { noteEn: b.noteEn } : {}),
    ...(b.noteAs ? { noteAs: b.noteAs } : {}),
  };
}
