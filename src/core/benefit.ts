// Benefit amount on a given date, with time-bounded overrides. Pure.
import { assertIsoDate } from "./dates";
import type { BenefitOn, SchemeRule } from "./types";

/**
 * The benefit that applies on `date` (YYYY-MM-DD). Overrides are inclusive
 * date windows; when several match, the last one listed wins.
 * `total` is null whenever the state top-up is unconfirmed (never show an unconfirmed total).
 */
export function benefitOn(scheme: SchemeRule, date: string): BenefitOn {
  assertIsoDate(date, "date");
  const base = scheme.benefit;
  const override = [...base.overrides].reverse().find((o) => o.from <= date && date <= o.to);

  const centralShare = override?.centralShare ?? base.centralShare;
  const stateTopUp = override && override.stateTopUp !== undefined ? override.stateTopUp : base.stateTopUp;

  return {
    centralShare,
    stateTopUp,
    total: stateTopUp === null ? null : centralShare + stateTopUp,
    period: base.period,
    ...(base.instalments !== undefined ? { instalments: base.instalments } : {}),
    isOverride: override !== undefined,
    ...(override ? { noteEn: override.noteEn, noteAs: override.noteAs } : {}),
    provenance: override ? override.provenance : base.provenance,
  };
}
