// POST /api/decode with the AI mocked (no network). The route's answer is decided by code.
import { afterEach, describe, expect, it, vi } from "vitest";

const classify = vi.fn();
vi.mock("@/server/ai", async (orig) => ({ ...(await orig<object>()), classifyRejection: classify }));

afterEach(() => {
  classify.mockReset();
});

async function post(body: unknown) {
  const { POST } = await import("@/app/api/decode/route");
  return POST(new Request("http://localhost/api/decode", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }));
}

describe("POST /api/decode", () => {
  it('"Payment failed: Aadhaar not seeded with bank account" → AADHAAR_NOT_SEEDED_BANK with Assamese fix steps', async () => {
    classify.mockResolvedValue({ code: "AADHAAR_NOT_SEEDED_BANK", confidence: 0.95 });
    const res = await post({ text: "Payment failed: Aadhaar not seeded with bank account" });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ai).toBe("ok");
    expect(body.result).toMatchObject({ status: "matched", code: "AADHAAR_NOT_SEEDED_BANK", confidence: 0.95, ask: [] });
    expect(body.result.fix.stepsAs.length).toBeGreaterThan(0);
    expect(body.result.fix.stepsAs.every((s: string) => /[\u0980-\u09FF]/.test(s))).toBe(true);
    expect(classify).toHaveBeenCalledWith("Payment failed: Aadhaar not seeded with bank account");
  });

  it("low confidence or UNKNOWN → needs_verification + what to ask at the office", async () => {
    classify.mockResolvedValueOnce({ code: "LAND_NOT_VERIFIED", confidence: 0.5 });
    const low = (await (await post({ text: "status: under process at level 2" })).json()).result;
    expect(low).toMatchObject({ status: "needs_verification", code: "UNKNOWN" });
    expect(low.possible.code).toBe("LAND_NOT_VERIFIED");
    expect(low.ask.length).toBeGreaterThan(0);

    classify.mockResolvedValueOnce({ code: "UNKNOWN", confidence: 0.9 });
    const unknown = (await (await post({ text: "something odd" })).json()).result;
    expect(unknown).toMatchObject({ status: "needs_verification", code: "UNKNOWN", possible: null });
  });

  it("AI unavailable or failing → still a useful needs_verification answer (200)", async () => {
    classify.mockResolvedValueOnce({ error: "ai_unavailable" });
    const a = await (await post({ text: "Rejected" })).json();
    expect(a).toMatchObject({ ai: "ai_unavailable", result: { status: "needs_verification", code: "UNKNOWN", confidence: null } });
    classify.mockRejectedValueOnce(new Error("boom"));
    expect((await (await post({ text: "Rejected" })).json()).ai).toBe("ai_failed");
  });

  it("bad requests → 400 before any AI call", async () => {
    expect((await post({ text: "  " })).status).toBe(400);
    expect((await post({ text: "x".repeat(2001) })).status).toBe(400);
    expect((await post({ nope: 1 })).status).toBe(400);
    expect(classify).not.toHaveBeenCalled();
  });
});
