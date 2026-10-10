// classifyRejection (ai.ts): fetch is injected, no network.
import { describe, expect, it, vi } from "vitest";
import { type AiLogEntry, classifyRejection } from "./ai";

const ENV = { CLINE_API_KEY: "test-key-not-real", CLINE_MODEL: "anthropic/claude-sonnet-5.5" };
const reply = (content: string, status = 200) => new Response(JSON.stringify({ data: { choices: [{ message: { content } }] } }), { status });

function setup(responses: (Response | Error)[]) {
  const logs: AiLogEntry[] = [];
  const fetchMock = vi.fn(async () => {
    const next = responses.shift();
    if (!next) throw new Error("no more responses");
    if (next instanceof Error) throw next;
    return next;
  });
  return { logs, fetchMock, deps: { fetch: fetchMock as unknown as typeof fetch, env: ENV, log: (e: AiLogEntry) => logs.push(e) } };
}

describe("classifyRejection", () => {
  it("returns one zod-validated code + confidence; masks Aadhaar before sending; logs no personal data", async () => {
    const { fetchMock, logs, deps } = setup([reply('```json\n{"code":"AADHAAR_NOT_SEEDED_BANK","confidence":0.93}\n```')]);
    const text = "Payment failed: Aadhaar 1234 5678 4821 not seeded with bank account 30012345678 (Ramesh)";
    expect(await classifyRejection(text, deps)).toEqual({ code: "AADHAAR_NOT_SEEDED_BANK", confidence: 0.93 });

    const sent = String((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body);
    expect(sent).toContain("XXXX XXXX 4821");
    expect(sent).not.toContain("1234 5678");
    expect(sent).not.toContain("30012345678");
    expect(sent).toContain("PENDING_STATE_ACTION"); // the allowed codes are listed in the prompt

    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({ fn: "classifyRejection", outcome: "ok", promptVersion: "classify-rejection-v1", model: ENV.CLINE_MODEL });
    expect(logs[0].inputHash).toMatch(/^[0-9a-f]{16}$/);
    for (const secret of ["Ramesh", "4821", "30012345678", ENV.CLINE_API_KEY]) expect(JSON.stringify(logs)).not.toContain(secret);
  });

  it("a code outside the enum or a confidence outside 0–1 is rejected; one retry, then ai_failed", async () => {
    const { fetchMock, logs, deps } = setup([reply('{"code":"BANK_ISSUE","confidence":0.9}'), reply('{"code":"EKYC_PENDING","confidence":1.4}')]);
    expect(await classifyRejection("eKYC pending", deps)).toEqual({ error: "ai_failed" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(logs.map((l) => l.outcome)).toEqual(["bad_output", "bad_output"]);
  });

  it("retries once after an HTTP error, then succeeds", async () => {
    const { deps, logs } = setup([reply("{}", 500), reply('{"code":"EKYC_PENDING","confidence":0.88}')]);
    expect(await classifyRejection("eKYC not done", deps)).toEqual({ code: "EKYC_PENDING", confidence: 0.88 });
    expect(logs.map((l) => l.outcome)).toEqual(["http_error", "ok"]);
  });

  it("no key/model → ai_unavailable; empty or too long text → invalid_text; never calls the network", async () => {
    const { fetchMock, deps } = setup([]);
    expect(await classifyRejection("Name mismatch", { ...deps, env: {} })).toEqual({ error: "ai_unavailable" });
    expect(await classifyRejection("   ", deps)).toEqual({ error: "invalid_text" });
    expect(await classifyRejection("x".repeat(2001), deps)).toEqual({ error: "invalid_text" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
