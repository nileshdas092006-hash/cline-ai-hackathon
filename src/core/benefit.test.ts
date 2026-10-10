import { describe, expect, it } from "vitest";
import { benefitOn } from "./benefit";
import { getScheme } from "./schemes";
import { SchemeRule } from "./types";

function scheme(id: string): SchemeRule {
  const s = getScheme(id);
  if (!s) throw new Error(`missing scheme ${id}`);
  return s;
}

const orunodoi = scheme("orunodoi-3");

const octoberOverride = SchemeRule.parse({
  ...orunodoi,
  version: "2.1.0",
  benefit: {
    ...orunodoi.benefit,
    overrides: [
      {
        from: "2026-10-01",
        to: "2026-10-31",
        stateTopUp: 1500,
        noteEn: "One-time ₹1,500 for October 2026 instead of ₹1,250.",
        noteAs: "২০২৬ চনৰ অক্টোবৰ মাহৰ বাবে ₹১,২৫০ৰ সলনি এবাৰৰ বাবে ₹১,৫০০।",
        provenance: {
          sourceUrl: null,
          sourceTitle: "Demo notice: Orunodoi October 2026 payment",
          verifiedOn: "2026-10-10",
          version: "2.1.0",
          status: "provisional",
        },
      },
    ],
  },
});

describe("benefitOn", () => {
  it("Orunodoi with a 2026-10 override: 1500 in October, 1250 in November", () => {
    const oct = benefitOn(octoberOverride, "2026-10-15");
    expect(oct.stateTopUp).toBe(1500);
    expect(oct.total).toBe(1500);
    expect(oct.isOverride).toBe(true);
    expect(oct.provenance.status).toBe("provisional");

    const nov = benefitOn(octoberOverride, "2026-11-01");
    expect(nov.stateTopUp).toBe(1250);
    expect(nov.total).toBe(1250);
    expect(nov.isOverride).toBe(false);
  });

  it("the override window is inclusive at both ends", () => {
    expect(benefitOn(octoberOverride, "2026-10-01").total).toBe(1500);
    expect(benefitOn(octoberOverride, "2026-10-31").total).toBe(1500);
    expect(benefitOn(octoberOverride, "2026-09-30").total).toBe(1250);
  });

  it("the built-in Orunodoi rule pays the recurring 1250 in October (no override yet)", () => {
    const b = benefitOn(orunodoi, "2026-10-15");
    expect(b).toMatchObject({ centralShare: 0, stateTopUp: 1250, total: 1250, period: "month", isOverride: false });
  });

  it("PM-KISAN: 6000 a year in 3 instalments, all central", () => {
    expect(benefitOn(scheme("pm-kisan"), "2026-10-10")).toMatchObject({
      centralShare: 6000,
      stateTopUp: 0,
      total: 6000,
      period: "year",
      instalments: 3,
    });
  });

  it("widow pension: central 300 a month, unconfirmed state top-up gives no total", () => {
    const b = benefitOn(scheme("nsap-widow"), "2026-10-10");
    expect(b.centralShare).toBe(300);
    expect(b.stateTopUp).toBeNull();
    expect(b.total).toBeNull();
    expect(b.period).toBe("month");
  });

  it("rejects an override whose end is before its start", () => {
    const bad = {
      ...octoberOverride,
      benefit: {
        ...octoberOverride.benefit,
        overrides: [{ ...octoberOverride.benefit.overrides[0], from: "2026-11-01", to: "2026-10-01" }],
      },
    };
    expect(SchemeRule.safeParse(bad).success).toBe(false);
  });
});
