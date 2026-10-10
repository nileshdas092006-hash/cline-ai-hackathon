// POST /api/extract, called directly. ai.ts is mocked; no network.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST as extractPost } from "@/app/api/extract/route";
import { extractDocument } from "@/server/ai";

vi.mock("@/server/ai", () => ({ extractDocument: vi.fn() }));
const extractMock = vi.mocked(extractDocument);

const post = (body: unknown) =>
  new Request("http://localhost/api/extract", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
const image = "data:image/jpeg;base64,AAAAAAAAAAAAAAAAAAAAAAAA";

describe("POST /api/extract", () => {
  // Block body on purpose: a function returned from beforeEach is run by Vitest as a teardown,
  // and mockReset() returns the mock itself.
  beforeEach(() => {
    extractMock.mockReset();
  });

  it("returns the extracted document", async () => {
    const doc = { docType: "aadhaar" as const, fields: { name: "X Y", aadhaarLast4: "4821" }, confidence: { name: 0.6 } };
    extractMock.mockResolvedValue({ doc, detectedDocType: "aadhaar" });
    const res = await extractPost(post({ image, docType: "aadhaar" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ doc, detectedDocType: "aadhaar" });
    expect(extractMock).toHaveBeenCalledWith(image, "aadhaar");
  });

  it("AI unavailable → 503 { error: ai_unavailable } so the UI falls back to manual entry", async () => {
    extractMock.mockResolvedValue({ error: "ai_unavailable" });
    const res = await extractPost(post({ image }));
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: "ai_unavailable" });
  });

  it("AI failed → 502, invalid image → 400", async () => {
    extractMock.mockResolvedValueOnce({ error: "ai_failed" });
    expect((await extractPost(post({ image }))).status).toBe(502);
    extractMock.mockResolvedValueOnce({ error: "invalid_image" });
    expect((await extractPost(post({ image }))).status).toBe(400);
  });

  it("validates the request before calling the model", async () => {
    expect((await extractPost(post({}))).status).toBe(400);
    expect((await extractPost(post({ image, docType: "passport" }))).status).toBe(400);
    expect((await extractPost(post("nope"))).status).toBe(400);
    expect(extractMock).not.toHaveBeenCalled();
  });

  it("never crashes if the gateway throws", async () => {
    extractMock.mockRejectedValue(new Error("boom"));
    const res = await extractPost(post({ image }));
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: "ai_failed" });
  });
});
