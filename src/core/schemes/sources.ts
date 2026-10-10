// Provenance builders for the rule packs (docs/schemes.md v2, checked 2026-10-10). Pure.
import type { RuleProvenance } from "../types";

export const VERIFIED_ON = "2026-10-10";
export const PACK_VERSION = "2.0.0";

export interface Source {
  sourceUrl: string | null;
  sourceTitle: string;
}

export const SOURCES = {
  pmKisanPortal: {
    sourceUrl: "https://pmkisan.gov.in/",
    sourceTitle: "PM-KISAN official portal (Government of India)",
  },
  pmKisanGuide: {
    sourceUrl:
      "https://en.vikaspedia.in/viewcontent/agriculture/policies-and-schemes/crops-related/comprehensive-guide-to-the-pradhan-mantri-kisan-samman-nidhi-(pm-kisan)-scheme?lgn=en",
    sourceTitle: "Vikaspedia: Comprehensive guide to PM-KISAN",
  },
  orunodoiOfficial: {
    sourceUrl: "https://dhemaji.assam.gov.in/scheme-page/orunodoi",
    sourceTitle: "Orunodoi scheme page, Government of Assam (last updated 8 May 2025)",
  },
  orunodoiSecondary: {
    sourceUrl: "https://www.publicservicesmap.in/schemes/orunodoi-3.0--aos?lang=en",
    sourceTitle: "Public Services Map: Orunodoi 3.0 (secondary source, not confirmed for 3.0)",
  },
  ignwps: {
    sourceUrl: "https://www.publicservicesmap.in/schemes/indira-gandhi-national-widow-pension-scheme--ignwps",
    sourceTitle: "Public Services Map: Indira Gandhi National Widow Pension Scheme (IGNWPS, NSAP)",
  },
} satisfies Record<string, Source>;

export function verified(source: Source, clause?: string): RuleProvenance {
  return {
    ...source,
    ...(clause ? { clause } : {}),
    verifiedOn: VERIFIED_ON,
    version: PACK_VERSION,
    status: "verified",
  };
}

export function provisional(source: Source, clause?: string): RuleProvenance {
  return {
    ...source,
    ...(clause ? { clause } : {}),
    verifiedOn: VERIFIED_ON,
    version: PACK_VERSION,
    status: "provisional",
  };
}
