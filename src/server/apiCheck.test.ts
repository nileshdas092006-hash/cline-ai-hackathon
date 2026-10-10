// POST /api/check, called directly. ai.ts is mocked (no network, and it must never be needed here).
import { describe, expect, it, vi } from "vitest";
import { POST as checkPost } from "@/app/api/check/route";
import { SAMPLES } from "@/core/samples";
import { Report } from "@/core/types";
import { todayInIndia } from "@/server/api";

vi.mock("@/server/ai", () => ({ extractDocument: vi.fn() }));

const post = (body: unknown) =>
  new Request("http://localhost/api/check", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });

const AS_OF = "2026-10-10";
async function check(body: unknown) {
  const res = await checkPost(post(body));
  return { status: res.status, json: await res.json() };
}
function sample(id: keyof typeof SAMPLES) {
  const s = SAMPLES[id];
  return { schemeId: s.schemeId, docs: s.docs, answers: s.answers, asOfDate: AS_OF };
}

describe("POST /api/check", () => {
  it("sample A → ready_for_review, with bank seeding flagged needs_verification", async () => {
    const { status, json } = await check(sample("A"));
    expect(status).toBe(200);
    const report = Report.parse(json);
    expect(report.eligibility).toBe("likely_eligible");
    expect(report.readiness).toBe("ready_for_review");
    expect(report.checks.find((c) => c.id === "ext_aadhaar_bank_seeding")?.result).toBe("needs_verification");
  });

  it("sample B → action_required, naming the land record and the bank name variant", async () => {
    const report = Report.parse((await check(sample("B"))).json);
    expect(report.readiness).toBe("action_required");
    const land = report.checks.find((c) => c.id === "name_land_record");
    const bank = report.checks.find((c) => c.id === "name_bank_passbook");
    expect(land?.result).toBe("action_required");
    expect(land?.messageEn).toContain("land record");
    expect(bank?.result).toBe("needs_verification");
    expect(bank?.match?.level).toBe("possible_match");
  });

  it("sample C → action_required because the death certificate is missing", async () => {
    const report = Report.parse((await check(sample("C"))).json);
    expect(report.readiness).toBe("action_required");
    expect(report.checks.find((c) => c.id === "doc_death_certificate")?.result).toBe("action_required");
  });

  it("manual entry (no AI confidence at all) completes the flow", async () => {
    const docs = [
      { docType: "aadhaar", fields: { name: "Ramesh Kumar Sharma", dob: "1975-03-12", aadhaarLast4: "4821" }, confidence: {} },
      { docType: "bank_passbook", fields: { name: "Ramesh Kumar Sharma", accountNo: "30012345678", ifsc: "SBIN0001234" }, confidence: {} },
      { docType: "land_record", fields: { ownerNames: ["Ramesh Kumar Sharma"] }, confidence: {} },
    ];
    const report = Report.parse((await check({ ...sample("A"), docs })).json);
    expect(report.readiness).toBe("ready_for_review");
  });

  it("defaults asOfDate to today in India", async () => {
    const { schemeId, docs, answers } = sample("A");
    const report = Report.parse((await check({ schemeId, docs, answers })).json);
    expect(report.asOfDate).toBe(todayInIndia());
    expect(todayInIndia(new Date("2026-10-09T20:00:00Z"))).toBe("2026-10-10"); // 01:30 IST
  });

  it("rejects bad input: unknown scheme/version 404; bad JSON, date or full Aadhaar 400", async () => {
    expect((await check({ ...sample("A"), schemeId: "nope" })).status).toBe(404);
    expect((await check({ ...sample("A"), schemeVersion: "9.9.9" })).status).toBe(404);
    expect((await checkPost(post("{not json"))).status).toBe(400);
    expect((await check({ ...sample("A"), asOfDate: "2026-02-30" })).status).toBe(400);
    const fullAadhaar = [{ docType: "aadhaar", fields: { aadhaarLast4: "123456784821" }, confidence: {} }];
    expect((await check({ ...sample("A"), docs: fullAadhaar })).status).toBe(400);
    const extraField = [{ docType: "aadhaar", fields: { aadhaarNumber: "123456784821" }, confidence: {} }];
    expect((await check({ ...sample("A"), docs: extraField })).status).toBe(400);
  });

  it("an error response never echoes the submitted personal data", async () => {
    const docs = [{ docType: "aadhaar", fields: { name: "Secret Person", aadhaarLast4: "123456784821" }, confidence: {} }];
    const { json } = await check({ ...sample("A"), docs });
    expect(JSON.stringify(json)).not.toContain("Secret");
    expect(JSON.stringify(json)).not.toContain("12345678");
  });
});
