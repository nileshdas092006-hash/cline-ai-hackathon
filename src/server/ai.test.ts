import { describe, expect, it, vi } from "vitest";
import { type AiLogEntry, extractDocument, isAiConfigured, jsonFromReply, parseImage, replyText } from "./ai";

// A tiny fake "image" (valid base64). No network: fetch is always injected.
const IMAGE = `data:image/jpeg;base64,${Buffer.from("fake-image-bytes-for-tests-only").toString("base64")}`;
const ENV = { CLINE_API_KEY: "test-key-not-real", CLINE_MODEL: "anthropic/claude-sonnet-5.5" };

function reply(content: string, status = 200) {
  return new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status });
}

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

describe("extractDocument", () => {
  it("without a key or model → ai_unavailable, and never calls the network", async () => {
    const { fetchMock, deps } = setup([]);
    expect(await extractDocument(IMAGE, "aadhaar", { ...deps, env: {} })).toEqual({ error: "ai_unavailable" });
    expect(await extractDocument(IMAGE, "aadhaar", { ...deps, env: { CLINE_API_KEY: "k" } })).toEqual({ error: "ai_unavailable" });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(isAiConfigured({})).toBe(false);
    expect(isAiConfigured(ENV)).toBe(true);
  });

  it("rejects something that is not an image", async () => {
    const { fetchMock, deps } = setup([]);
    expect(await extractDocument("not base64 at all!", undefined, deps)).toEqual({ error: "invalid_image" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("parses a fenced JSON reply, masks Aadhaar to the last 4 digits, and logs no personal data", async () => {
    const content =
      '```json\n{"docType":"aadhaar","fields":{"name":"Ramesh Kumar Sharma","dob":"12/03/1975","aadhaarLast4":"1234 5678 4821"},"confidence":{"name":0.97,"dob":0.6,"aadhaarLast4":0.99}}\n```';
    const { fetchMock, logs, deps } = setup([reply(content)]);
    const r = await extractDocument(IMAGE, "aadhaar", deps);
    expect(r).toEqual({
      detectedDocType: "aadhaar",
      doc: {
        docType: "aadhaar",
        fields: { name: "Ramesh Kumar Sharma", dob: "1975-03-12", aadhaarLast4: "4821" },
        confidence: { name: 0.97, dob: 0.6, aadhaarLast4: 0.99 },
      },
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.cline.bot/api/v1/chat/completions");
    const sent = JSON.parse(String(init.body));
    expect(sent.model).toBe(ENV.CLINE_MODEL);
    expect(JSON.stringify(sent.messages)).toContain("image_url");

    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({ outcome: "ok", model: ENV.CLINE_MODEL, promptVersion: "extract-doc-v1", attempt: 1 });
    expect(logs[0].inputHash).toMatch(/^[0-9a-f]{16}$/);
    const logText = JSON.stringify(logs);
    for (const secret of ["Ramesh", "4821", "12345678", ENV.CLINE_API_KEY]) expect(logText).not.toContain(secret);
  });

  it("retries once after bad output, then succeeds (Cline API { data } wrapper)", async () => {
    const wrapped = (content: string) => new Response(JSON.stringify({ data: { choices: [{ message: { content } }] } }));
    const { fetchMock, logs, deps } = setup([
      reply("sorry, I cannot help"),
      wrapped('{"docType":"bank_passbook","fields":{"name":"RAMESH KR SHARMA","ifsc":"SBIN0001234"},"confidence":{"name":0.9}}'),
    ]);
    const r = await extractDocument(IMAGE, "bank_passbook", deps);
    expect("doc" in r && r.doc.fields.name).toBe("RAMESH KR SHARMA");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(logs.map((l) => l.outcome)).toEqual(["bad_output", "ok"]);
  });

  it("gives up after one retry with a safe fallback (HTTP error, then network error)", async () => {
    const { fetchMock, logs, deps } = setup([reply("{}", 400), new TypeError("fetch failed")]);
    expect(await extractDocument(IMAGE, "land_record", deps)).toEqual({ error: "ai_failed" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(logs.map((l) => l.outcome)).toEqual(["http_error", "network_error"]);
    expect(logs[0].status).toBe(400);
  });

  it("falls back when the reply is valid JSON but the wrong shape", async () => {
    const { deps } = setup([reply('{"fields":"nope"}'), reply("[1,2,3]")]);
    expect(await extractDocument(IMAGE, undefined, deps)).toEqual({ error: "ai_failed" });
  });
});

describe("helpers", () => {
  it("parseImage accepts data URLs and bare base64, rejects junk and huge images", () => {
    expect(parseImage(IMAGE)?.mime).toBe("image/jpeg");
    expect(parseImage(IMAGE.replace("data:image/jpeg;base64,", ""))?.mime).toBe("image/jpeg");
    expect(parseImage("data:image/png;base64,@@@@")).toBeNull();
    expect(parseImage("A".repeat(9 * 1024 * 1024))).toBeNull();
  });

  it("replyText reads plain OpenAI bodies and the Cline API's { data: { choices } } wrapper", () => {
    const choices = [{ message: { content: '{"a":1}' } }];
    expect(replyText({ choices })).toBe('{"a":1}');
    expect(replyText({ data: { choices } })).toBe('{"a":1}');
    expect(replyText({ choices: [{ message: { content: [{ type: "text", text: "x" }, { type: "text", text: "y" }] } }] })).toBe("xy");
    expect(replyText(null)).toBe("");
  });

  it("jsonFromReply finds the JSON object inside extra text", () => {
    expect(jsonFromReply('Here you go: {"a":1} thanks')).toEqual({ a: 1 });
    expect(() => jsonFromReply("no json")).toThrow();
  });
});
