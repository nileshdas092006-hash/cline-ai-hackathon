// What the UI needs to know about each scheme (serialisable, no functions). Pure.
import { docSlotsFor, type DocSlot } from "./flow";
import { questionsFor } from "./schemes";
import type { Benefit, Question, SchemeRule } from "./types";

export const FLAGSHIP_SCHEME_ID = "pm-kisan";

export interface SchemeView {
  id: string;
  version: string;
  nameEn: string;
  nameAs: string;
  flagship: boolean;
  benefit: Pick<Benefit, "centralShare" | "stateTopUp" | "period">;
  slots: DocSlot[];
  questions: Question[];
  /** Short labels for the external checks, keyed by the engine's check id (`ext_<id>`). */
  external: { checkId: string; labelEn: string; labelAs: string }[];
}

export function schemeView(s: SchemeRule): SchemeView {
  return {
    id: s.id,
    version: s.version,
    nameEn: s.nameEn,
    nameAs: s.nameAs,
    flagship: s.id === FLAGSHIP_SCHEME_ID,
    benefit: { centralShare: s.benefit.centralShare, stateTopUp: s.benefit.stateTopUp, period: s.benefit.period },
    slots: docSlotsFor(s),
    questions: questionsFor(s),
    external: s.externalChecks.map((e) => ({ checkId: `ext_${e.id}`, labelEn: e.labelEn, labelAs: e.labelAs })),
  };
}

/** Flagship first, then the registry order. */
export function catalogOf(schemes: readonly SchemeRule[]): SchemeView[] {
  const views = schemes.map(schemeView);
  return [...views.filter((v) => v.flagship), ...views.filter((v) => !v.flagship)];
}
