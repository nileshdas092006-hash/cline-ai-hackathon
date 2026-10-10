// Manual LIVE check of the Rule Maintenance Agent (real Cline API; not part of `npm test`).
// Runs both demo notices from docs/ through POST /api/admin/rules/propose on a running server and
// prints each tool call, the proposed changes and the test results. Never prints secrets.
//
// Usage:
//   npm run build && npx next start -p 3123
//   node scripts/agent-smoke.mjs http://localhost:3123            (propose only)
//   node scripts/agent-smoke.mjs http://localhost:3123 --publish  (also publish, then check the citizen API)
// Use a throwaway database for --publish, e.g. start the server with KAAGAZ_DB_PATH=data/smoke.db.
import { readFile } from "node:fs/promises";

const base = process.argv.find((a) => a.startsWith("http")) ?? "http://localhost:3000";
const publish = process.argv.includes("--publish");

/** Same extraction as src/core/notice.ts noticeFromDemoFile (kept in sync by hand; it is tiny). */
function noticeFromDemoFile(md) {
  const parts = md.replace(/\r\n?/g, "\n").split(/^\s*---\s*$/m);
  const intro = parts[0] ?? "";
  const body = parts.length > 1 ? parts[1] : intro;
  const source = /Source:\s*(https?:\/\/\S+?)[*_)\s]*$/m.exec(intro)?.[1];
  return [source ? `Source: ${source}` : "", body].filter(Boolean).join("\n\n").trim();
}

async function propose(label, file) {
  const notice = noticeFromDemoFile(await readFile(new URL(`../docs/${file}`, import.meta.url), "utf8"));
  console.log(`\n=== ${label} (${notice.length} chars) ===`);
  const started = Date.now();
  const res = await fetch(`${base}/api/admin/rules/propose`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ notice }) });
  if (!res.ok || !res.body) {
    console.log("request failed:", res.status, await res.text());
    return null;
  }
  let result = null;
  let buffer = "";
  const decoder = new TextDecoder();
  for await (const chunk of res.body) {
    buffer += decoder.decode(chunk, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines.filter((l) => l.trim())) {
      const e = JSON.parse(line);
      if (e.type === "tool" && e.phase === "finished") console.log(`  ${e.isError ? "⚠" : "✓"} ${e.name}: ${e.summary}`);
      if (e.type === "text") console.log(`  agent: ${e.text.slice(0, 300)}`);
      if (e.type === "done") result = e.result;
    }
  }
  console.log(`  time: ${((Date.now() - started) / 1000).toFixed(1)}s`);
  if (!result?.ok) {
    console.log("  RESULT: no proposal:", result?.error, result?.message);
    return null;
  }
  const p = result.proposal;
  console.log(`  RESULT: proposal #${p.id} ${p.schemeId} ${p.previousVersion ?? "(new)"} → ${p.version} [${p.status}]`);
  console.log(`  summary: ${p.summary}`);
  for (const c of p.changes.slice(0, 15)) console.log(`    ${c.kind.padEnd(7)} ${c.path}`);
  const t = p.testResult;
  const newTests = t.results.filter((r) => r.origin === "new");
  const reg = t.results.filter((r) => r.origin === "regression");
  console.log(`  tests: ${t.passed}/${t.total} passed (new ${newTests.filter((r) => r.passed).length}/${newTests.length}, regression ${reg.filter((r) => r.passed).length}/${reg.length})`);
  for (const r of newTests) console.log(`    ${r.passed ? "✓" : "✗"} ${r.id}: ${r.description}`);
  return p;
}

async function post(path, body) {
  const res = await fetch(`${base}${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, ...(body ? { body: JSON.stringify(body) } : {}) });
  return { status: res.status, json: await res.json() };
}

const oap = await propose("Old Age Pension (new scheme)", "sample-guideline-ignoaps.md");
const oru = await propose("Orunodoi October 2026 (one-time ₹1,500)", "sample-notice-orunodoi-oct2026.md");

if (publish) {
  console.log("\n=== publish + citizen check ===");
  for (const p of [oap, oru].filter(Boolean)) {
    const r = await post(`/api/admin/rules/${p.id}/publish`);
    console.log(`publish #${p.id}:`, r.status, JSON.stringify(r.json.row ?? r.json));
  }
  if (oru) {
    for (const date of ["2026-10-15", "2026-11-15"]) {
      const r = await post("/api/check", { schemeId: "orunodoi-3", docs: [], answers: {}, asOfDate: date });
      console.log(`orunodoi on ${date}:`, r.status, r.json.schemeVersion, `stateTopUp=${r.json.benefit?.stateTopUp}`, `override=${r.json.benefit?.isOverride}`);
    }
  }
  if (oap) {
    const r = await post("/api/check", { schemeId: oap.schemeId, docs: [], answers: {}, asOfDate: "2026-10-15" });
    console.log(`${oap.schemeId} selectable:`, r.status, r.json.schemeVersion, `central=${r.json.benefit?.centralShare}`);
    const home = await (await fetch(base)).text();
    console.log("home page lists it:", home.includes(oap.nameEn) || home.includes(oap.schemeId));
  }
}
