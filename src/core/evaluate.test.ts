import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { evaluate } from "./evaluate";
import { nameMatch } from "./nameMatch";
import { SAMPLES } from "./samples";
import { getScheme } from "./schemes";
import { Report, SchemeRule, type Answers, type Check, type ExtractedDoc } from "./types";

const AS_OF = "2026-10-10";

function scheme(id: string): SchemeRule {
  const s = getScheme(id);
  if (!s) throw new Error(`missing scheme ${id}`);
  return s;
}
const pmKisan = scheme("pm-kisan");
const widow = scheme("nsap-widow");
const orunodoi = scheme("orunodoi-3");

function check(report: Report, id: string): Check {
  const c = report.checks.find((x) => x.id === id);
  if (!c) throw new Error(`no check ${id} in ${report.checks.map((x) => x.id).join(", ")}`);
  return c;
}

// ---------- PM-KISAN fixtures (fake people) ----------
const aadhaar = (name: string, dob = "1975-03-12"): ExtractedDoc => ({
  docType: "aadhaar",
  fields: { name, dob, aadhaarLast4: "4821" },
  confidence: {},
});
const passbook = (name: string, extra: Partial<ExtractedDoc["fields"]> = {}): ExtractedDoc => ({
  docType: "bank_passbook",
  fields: { name, accountNo: "30012345678", ifsc: "SBIN0001234", ...extra },
  confidence: {},
});
const land = (owner: string, extra: Partial<ExtractedDoc["fields"]> = {}): ExtractedDoc => ({
  docType: "land_record",
  fields: { ownerNames: [owner], ...extra },
  confidence: {},
});
const pmNo: Answers = {
  holds_constitutional_post: false,
  govt_employee: false,
  income_tax_payer: false,
  practising_professional: false,
  pension_10k_plus: false,
};
const pmCleanDocs = () => [
  aadhaar("Ramesh Kumar Sharma"),
  passbook("RAMESH KUMAR SHARMA"),
  land("Ramesh Kumar Sharma"),
];

describe("evaluate: PM-KISAN", () => {
  it("clean → likely_eligible + ready_for_review, with bank seeding as needs_verification", () => {
    const r = evaluate(pmKisan, pmCleanDocs(), pmNo, AS_OF);
    expect(r.eligibility).toBe("likely_eligible");
    expect(r.readiness).toBe("ready_for_review");
    const seeding = check(r, "ext_aadhaar_bank_seeding");
    expect(seeding.result).toBe("needs_verification");
    expect(seeding.kind).toBe("external");
    expect(seeding.fixWhere).toBe("bank");
    for (const id of ["ext_account_active", "ext_ekyc", "ext_land_verified"]) {
      expect(check(r, id).result).toBe("needs_verification");
    }
    expect(r.checks.filter((c) => c.result === "action_required")).toEqual([]);
    expect(check(r, "name_bank_passbook").result).toBe("ok");
    expect(check(r, "name_land_record").result).toBe("ok");
    expect(r.schemeVersion).toBe(pmKisan.version);
    expect(r.asOfDate).toBe(AS_OF);
  });

  it("bank name \"RAMESH KR SHARMA\" → needs_verification (possible match, never ok)", () => {
    const docs = [aadhaar("Ramesh Kumar Sharma"), passbook("RAMESH KR SHARMA"), land("Ramesh Kumar Sharma")];
    const r = evaluate(pmKisan, docs, pmNo, AS_OF);
    expect(r.readiness).toBe("needs_verification");
    const c = check(r, "name_bank_passbook");
    expect(c.result).toBe("needs_verification");
    expect(c.match?.level).toBe("possible_match");
    expect(c.fixWhere).toBe("bank");
    expect(c.messageEn).toMatch(/Officials may still reject this/);
  });

  it("land record \"Rameshwar Sharma\" → action_required, fix at the circle office", () => {
    const docs = [aadhaar("Ramesh Kumar Sharma"), passbook("RAMESH KUMAR SHARMA"), land("Rameshwar Sharma")];
    const r = evaluate(pmKisan, docs, pmNo, AS_OF);
    expect(r.readiness).toBe("action_required");
    const c = check(r, "name_land_record");
    expect(c.result).toBe("action_required");
    expect(c.match?.level).toBe("mismatch");
    expect(c.fixWhere).toBe("circle_office");
  });

  it("sample B (KR on bank + Rameshwar on land) → action_required", () => {
    const b = SAMPLES.B;
    const r = evaluate(scheme(b.schemeId), b.docs, b.answers, AS_OF);
    expect(r.readiness).toBe("action_required");
    expect(check(r, "name_bank_passbook").result).toBe("needs_verification");
    expect(check(r, "name_land_record").result).toBe("action_required");
  });

  it("sample A → ready_for_review", () => {
    const a = SAMPLES.A;
    const r = evaluate(scheme(a.schemeId), a.docs, a.answers, AS_OF);
    expect(r.eligibility).toBe("likely_eligible");
    expect(r.readiness).toBe("ready_for_review");
  });

  it("missing land_record → action_required", () => {
    const docs = [aadhaar("Ramesh Kumar Sharma"), passbook("RAMESH KUMAR SHARMA")];
    const r = evaluate(pmKisan, docs, pmNo, AS_OF);
    expect(r.readiness).toBe("action_required");
    expect(check(r, "doc_land_record").result).toBe("action_required");
    expect(check(r, "doc_land_record").fixWhere).toBe("circle_office");
  });

  it("income tax payer yes → not_eligible (verified exclusion)", () => {
    const r = evaluate(pmKisan, pmCleanDocs(), { ...pmNo, income_tax_payer: true }, AS_OF);
    expect(r.eligibility).toBe("not_eligible");
    expect(r.readiness).toBe("action_required");
    expect(check(r, "excl_income_tax_payer").result).toBe("action_required");
    expect(check(r, "excl_income_tax_payer").provenance.status).toBe("verified");
  });

  it("REGRESSION: a large landholding has no effect (the 2-ha limit was removed in 2019)", () => {
    const big = [aadhaar("Ramesh Kumar Sharma"), passbook("RAMESH KUMAR SHARMA"), land("Ramesh Kumar Sharma", { landAreaHectares: 25 })];
    const small = [aadhaar("Ramesh Kumar Sharma"), passbook("RAMESH KUMAR SHARMA"), land("Ramesh Kumar Sharma", { landAreaHectares: 0.5 })];
    const rBig = evaluate(pmKisan, big, pmNo, AS_OF);
    const rSmall = evaluate(pmKisan, small, pmNo, AS_OF);
    expect(rBig.eligibility).toBe("likely_eligible");
    expect(rBig.readiness).toBe("ready_for_review");
    expect(rBig).toEqual(rSmall);
    // and no rule in the pack mentions landholding size
    expect(JSON.stringify(pmKisan)).not.toMatch(/hectare|landholding_size|large_land/i);
  });

  it("an unanswered exclusion question → eligibility needs_verification", () => {
    const answers: Answers = { ...pmNo };
    delete answers.govt_employee;
    const r = evaluate(pmKisan, pmCleanDocs(), answers, AS_OF);
    expect(r.eligibility).toBe("needs_verification");
    expect(check(r, "excl_govt_employee").result).toBe("needs_verification");
  });

  it("a bad IFSC → action_required; a missing account number → needs_verification; a short one → action_required", () => {
    const r1 = evaluate(pmKisan, [aadhaar("Ramesh Kumar Sharma"), passbook("Ramesh Kumar Sharma", { ifsc: "SBIN1234" }), land("Ramesh Kumar Sharma")], pmNo, AS_OF);
    expect(check(r1, "field_ifsc").result).toBe("action_required");
    expect(r1.readiness).toBe("action_required");

    const r2 = evaluate(pmKisan, [aadhaar("Ramesh Kumar Sharma"), passbook("Ramesh Kumar Sharma", { accountNo: undefined }), land("Ramesh Kumar Sharma")], pmNo, AS_OF);
    expect(check(r2, "field_account_no").result).toBe("needs_verification");

    const r3 = evaluate(pmKisan, [aadhaar("Ramesh Kumar Sharma"), passbook("Ramesh Kumar Sharma", { accountNo: "1234" }), land("Ramesh Kumar Sharma")], pmNo, AS_OF);
    expect(check(r3, "field_account_no").result).toBe("action_required");
  });

  it("a low-confidence name → needs_verification even if it would match", () => {
    const docs = pmCleanDocs();
    docs[1] = { ...docs[1], confidence: { name: 0.4 } };
    const r = evaluate(pmKisan, docs, pmNo, AS_OF);
    expect(check(r, "name_bank_passbook").result).toBe("needs_verification");
    expect(r.readiness).toBe("needs_verification");
  });

  it("land in a family member's name: mismatch becomes needs_verification when the user says so", () => {
    const docs = [aadhaar("Ramesh Kumar Sharma"), passbook("RAMESH KUMAR SHARMA"), land("Sita Devi")];
    expect(check(evaluate(pmKisan, docs, pmNo, AS_OF), "name_land_record").result).toBe("action_required");
    const r = evaluate(pmKisan, docs, { ...pmNo, land_in_family_member_name: true }, AS_OF);
    expect(check(r, "name_land_record").result).toBe("needs_verification");
    expect(check(r, "name_land_record").fixWhere).toBe("circle_office");
  });

  it("every check has bilingual messages, a fixWhere and provenance; the report validates", () => {
    const r = evaluate(pmKisan, pmCleanDocs(), pmNo, AS_OF);
    expect(Report.safeParse(r).success).toBe(true);
    for (const c of r.checks) {
      expect(c.messageEn.length).toBeGreaterThan(5);
      expect(/[\u0980-\u09FF]/.test(c.messageAs)).toBe(true);
      expect(c.fixWhere).toBeTruthy();
      expect(c.provenance.verifiedOn).toBe("2026-10-10");
    }
  });

  it("never prints a full Aadhaar number (only the last 4 digits are stored)", () => {
    const r = evaluate(pmKisan, pmCleanDocs(), pmNo, AS_OF);
    expect(JSON.stringify(r)).not.toMatch(/\d{12}/);
  });

  it("rejects an invalid asOfDate", () => {
    expect(() => evaluate(pmKisan, pmCleanDocs(), pmNo, "2026-13-01")).toThrow(RangeError);
  });
});


// ---------- Widow pension ----------
const widowDocs = (dob: string, withDeathCert = true): ExtractedDoc[] => [
  { docType: "aadhaar", fields: { name: "Sunita Devi", dob, aadhaarLast4: "7315" }, confidence: {} },
  { docType: "bank_passbook", fields: { name: "SUNITA DEVI", accountNo: "40098765432", ifsc: "UTBI0ABC123" }, confidence: {} },
  { docType: "bpl_proof", fields: { name: "Sunita Devi" }, confidence: {} },
  ...(withDeathCert
    ? [{ docType: "death_certificate", fields: { name: "Mohan Lal" }, confidence: {} } satisfies ExtractedDoc]
    : []),
];
const widowYes: Answers = { is_widow: true, bpl_household: true };

describe("evaluate: widow pension (IGNWPS)", () => {
  it("age 39 → not_eligible", () => {
    const r = evaluate(widow, widowDocs("1986-10-11"), widowYes, AS_OF);
    expect(r.eligibility).toBe("not_eligible");
    expect(check(r, "age").result).toBe("action_required");
  });
  it("age 40 → likely_eligible", () => {
    const r = evaluate(widow, widowDocs("1986-10-10"), widowYes, AS_OF);
    expect(r.eligibility).toBe("likely_eligible");
    expect(r.readiness).toBe("ready_for_review");
    expect(check(r, "age").result).toBe("ok");
  });
  it("age 79 → likely_eligible", () => {
    expect(evaluate(widow, widowDocs("1946-10-11"), widowYes, AS_OF).eligibility).toBe("likely_eligible");
  });
  it("age 80 → not_eligible, and suggests the Old Age Pension", () => {
    const r = evaluate(widow, widowDocs("1946-10-10"), widowYes, AS_OF);
    expect(r.eligibility).toBe("not_eligible");
    expect(check(r, "age").messageEn).toMatch(/Old Age Pension/);
  });
  it("age uses the explicit asOfDate (same DOB, a day earlier → 39)", () => {
    expect(evaluate(widow, widowDocs("1986-10-10"), widowYes, "2026-10-09").eligibility).toBe("not_eligible");
  });
  it("benefit: centralShare 300, stateTopUp null (no unconfirmed total)", () => {
    const r = evaluate(widow, widowDocs("1970-01-01"), widowYes, AS_OF);
    expect(r.benefit.centralShare).toBe(300);
    expect(r.benefit.stateTopUp).toBeNull();
    expect(r.benefit.total).toBeNull();
  });
  it("an age range without max (e.g. IGNOAPS 60+) has no upper limit: age 105 → ok, 59 → not eligible", () => {
    const openEnded = SchemeRule.parse({ ...widow, id: "open-age", ageRange: { ...widow.ageRange!, min: 60, max: undefined } });
    expect(openEnded.ageRange?.max).toBeUndefined();
    const old = evaluate(openEnded, widowDocs("1921-01-01"), widowYes, AS_OF);
    expect(check(old, "age").result).toBe("ok");
    expect(check(old, "age").messageEn).toMatch(/60 or older/);
    expect(check(evaluate(openEnded, widowDocs("1967-10-11"), widowYes, AS_OF), "age").result).toBe("action_required");
    expect(SchemeRule.safeParse({ ...widow, ageRange: { ...widow.ageRange!, min: 80, max: 60 } }).success).toBe(false);
  });
  it("not BPL → not_eligible", () => {
    expect(evaluate(widow, widowDocs("1970-01-01"), { ...widowYes, bpl_household: false }, AS_OF).eligibility).toBe("not_eligible");
  });
  it("missing death certificate → action_required (sample C too)", () => {
    const r1 = evaluate(widow, widowDocs("1970-01-01", false), widowYes, AS_OF);
    expect(r1.readiness).toBe("action_required");
    expect(check(r1, "doc_death_certificate").result).toBe("action_required");
    expect(check(r1, "doc_death_certificate").provenance.status).toBe("provisional");

    const c = SAMPLES.C;
    const r2 = evaluate(scheme(c.schemeId), c.docs, c.answers, AS_OF);
    expect(r2.readiness).toBe("action_required");
    expect(check(r2, "doc_death_certificate").result).toBe("action_required");
  });
  it("no Aadhaar (no DOB) → age needs_verification", () => {
    const docs = widowDocs("1970-01-01").filter((d) => d.docType !== "aadhaar");
    const r = evaluate(widow, docs, widowYes, AS_OF);
    expect(check(r, "age").result).toBe("needs_verification");
    expect(r.eligibility).toBe("needs_verification");
  });
  it("a low-confidence DOB never gives a definitive not_eligible", () => {
    const docs = widowDocs("1986-10-11");
    docs[0] = { ...docs[0], confidence: { dob: 0.3 } };
    const r = evaluate(widow, docs, widowYes, AS_OF);
    expect(check(r, "age").result).toBe("needs_verification");
    expect(r.eligibility).toBe("needs_verification");
  });
});

// ---------- Orunodoi 3.0 ----------
const orunodoiDocs = (withRationCard = true): ExtractedDoc[] => [
  ...(withRationCard
    ? [{ docType: "ration_card", fields: { name: "Anjali Bora" }, confidence: {} } satisfies ExtractedDoc]
    : []),
  { docType: "aadhaar", fields: { name: "Anjali Bora", dob: "1980-05-05", aadhaarLast4: "2290" }, confidence: {} },
  { docType: "bank_passbook", fields: { name: "ANJALI BORA", accountNo: "50011122233", ifsc: "SBIN0004567" }, confidence: {} },
];
const orunodoiOk: Answers = {
  nfsa_enrolled: true,
  widow: true,
  elected_representative: false,
  professional: false,
  govt_staff_or_pensioner: false,
  contractor_or_trader: false,
  large_landholder: false,
  four_wheeler: false,
  similar_state_scheme: false,
};

describe("evaluate: Orunodoi 3.0", () => {
  it("no ration card → action_required", () => {
    const r = evaluate(orunodoi, orunodoiDocs(false), orunodoiOk, AS_OF);
    expect(r.readiness).toBe("action_required");
    expect(check(r, "doc_ration_card").result).toBe("action_required");
    expect(check(r, "doc_ration_card").provenance.status).toBe("verified");
  });

  it("four-wheeler yes → needs_verification, never not_eligible", () => {
    const r = evaluate(orunodoi, orunodoiDocs(), { ...orunodoiOk, four_wheeler: true }, AS_OF);
    expect(r.eligibility).toBe("needs_verification");
    const c = check(r, "excl_four_wheeler");
    expect(c.result).toBe("needs_verification");
    expect(c.provenance.status).toBe("provisional");
    expect(c.fixWhere).toBe("gram_panchayat");
    expect(c.messageEn).toMatch(/may make you ineligible/i);
  });

  it("clean → likely_eligible + ready_for_review; ration card validity is an external check", () => {
    const r = evaluate(orunodoi, orunodoiDocs(), orunodoiOk, AS_OF);
    expect(r.eligibility).toBe("likely_eligible");
    expect(r.readiness).toBe("ready_for_review");
    expect(check(r, "ext_ration_card_valid").result).toBe("needs_verification");
    expect(check(r, "name_aadhaar").result).toBe("ok");
    expect(check(r, "name_bank_passbook").result).toBe("ok");
  });

  it("none of the any-of conditions → needs_verification (provisional list)", () => {
    const r = evaluate(orunodoi, orunodoiDocs(), { ...orunodoiOk, widow: false }, AS_OF);
    expect(check(r, "anyof").result).toBe("needs_verification");
    expect(r.eligibility).toBe("needs_verification");
  });

  it("supporting documents are a checklist labelled 'confirm the current list'", () => {
    const r = evaluate(orunodoi, orunodoiDocs(), orunodoiOk, AS_OF);
    expect(r.supportingDocs.length).toBeGreaterThan(0);
    expect(r.supportingDocs.find((d) => d.docType === "aadhaar")?.present).toBe(true);
    expect(r.supportingDocs.find((d) => d.docType === "voter_id")?.present).toBe(false);
    expect(r.supportingDocsNoteEn).toMatch(/confirm the current list/i);
  });

  it("property: Orunodoi never says not_eligible, whatever the answers", () => {
    const ids = Object.keys(orunodoiOk);
    fc.assert(
      fc.property(
        fc.array(fc.option(fc.boolean(), { nil: undefined }), { minLength: ids.length, maxLength: ids.length }),
        fc.boolean(),
        (vals, rc) => {
          const answers: Answers = {};
          ids.forEach((id, i) => {
            const v = vals[i];
            if (v !== undefined) answers[id] = v;
          });
          return evaluate(orunodoi, orunodoiDocs(rc), answers, AS_OF).eligibility !== "not_eligible";
        },
      ),
      { numRuns: 300 },
    );
  });
});

// ---------- cross-cutting properties ----------
const tokens = ["Ramesh", "RAMESH", "KR", "Kumar", "Sharma", "R.", "Rameshwar", "Smt.", "Devi", "Debi", "Sunita", "रमेश", "ৰমেশ"];
const nameArb = fc.array(fc.constantFrom(...tokens), { minLength: 1, maxLength: 4 }).map((t) => t.join(" "));

describe("evaluate: properties", () => {
  it("possible_match (or anything short of same) never yields an ok check", () => {
    fc.assert(
      fc.property(nameArb, nameArb, nameArb, (a, b, l) => {
        const r = evaluate(pmKisan, [aadhaar(a), passbook(b), land(l)], pmNo, AS_OF);
        for (const c of r.checks) {
          if (c.match && c.match.level !== "same" && c.result === "ok") return false;
        }
        const bank = check(r, "name_bank_passbook");
        return !(nameMatch(a, b).level === "possible_match" && bank.result === "ok");
      }),
      { numRuns: 500 },
    );
  });

  it("is deterministic and always returns a valid report", () => {
    fc.assert(
      fc.property(nameArb, nameArb, fc.boolean(), (a, b, tax) => {
        const docs = [aadhaar(a), passbook(b), land(a)];
        const answers = { ...pmNo, income_tax_payer: tax };
        const r1 = evaluate(pmKisan, docs, answers, AS_OF);
        const r2 = evaluate(pmKisan, docs, answers, AS_OF);
        return Report.safeParse(r1).success && JSON.stringify(r1) === JSON.stringify(r2);
      }),
      { numRuns: 200 },
    );
  });

  it("ready_for_review exactly when no non-external check is action_required or needs_verification", () => {
    fc.assert(
      fc.property(nameArb, nameArb, (a, b) => {
        const r = evaluate(pmKisan, [aadhaar(a), passbook(b), land(a)], pmNo, AS_OF);
        const blocking = r.checks.some(
          (c) => c.kind !== "external" && (c.result === "action_required" || c.result === "needs_verification"),
        );
        return (r.readiness === "ready_for_review") === !blocking;
      }),
      { numRuns: 300 },
    );
  });
});

