// Manual smoke test against a running server (not part of `npm test`; never prints secrets).
// Usage: node scripts/smoke.mjs [baseUrl]   (default http://localhost:3000)
const base = process.argv[2] ?? "http://localhost:3000";

const docsA = [
  { docType: "aadhaar", fields: { name: "Ramesh Kumar Sharma", dob: "1975-03-12", aadhaarLast4: "4821" }, confidence: { name: 0.97 } },
  { docType: "bank_passbook", fields: { name: "RAMESH KUMAR SHARMA", accountNo: "30012345678", ifsc: "SBIN0001234" }, confidence: {} },
  { docType: "land_record", fields: { ownerNames: ["Ramesh Kumar Sharma"] }, confidence: {} },
];
const pmNo = { holds_constitutional_post: false, govt_employee: false, income_tax_payer: false, practising_professional: false, pension_10k_plus: false };
const cases = {
  A: { schemeId: "pm-kisan", docs: docsA, answers: pmNo },
  B: {
    schemeId: "pm-kisan",
    docs: [docsA[0], { ...docsA[1], fields: { ...docsA[1].fields, name: "RAMESH KR SHARMA" } }, { ...docsA[2], fields: { ownerNames: ["Rameshwar Sharma"] } }],
    answers: pmNo,
  },
  C: {
    schemeId: "nsap-widow",
    docs: [
      { docType: "aadhaar", fields: { name: "Smt. Sunita Devi", dob: "1968-07-01", aadhaarLast4: "7315" }, confidence: {} },
      { docType: "bank_passbook", fields: { name: "SUNITA DEVI", accountNo: "40098765432", ifsc: "UTBI0ABC123" }, confidence: {} },
      { docType: "bpl_proof", fields: {}, confidence: {} },
    ],
    answers: { is_widow: true, bpl_household: true },
  },
};

async function post(path, body) {
  const res = await fetch(`${base}${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return { status: res.status, json: await res.json() };
}

const html = await (await fetch(base)).text();
console.log("home:", {
  langAs: html.includes('lang="as"'),
  assameseTitle: html.includes("আপুনি কোনটো আঁচনিৰ বাবে আবেদন কৰিব?"),
  flagship: html.includes("মুখ্য ডেমো"),
});

for (const [id, body] of Object.entries(cases)) {
  const { status, json } = await post("/api/check", { ...body, asOfDate: "2026-10-10" });
  const notOk = json.checks?.filter((c) => c.result !== "ok" && c.result !== "not_applicable").map((c) => `${c.id}:${c.result}`);
  console.log(`check ${id}:`, status, json.eligibility, json.readiness, notOk);
}

// A tiny 1x1 PNG: not a real document. Shows the gateway path (model or graceful fallback).
const png = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
const ex = await post("/api/extract", { image: png, docType: "aadhaar" });
console.log("extract (1x1 test image):", ex.status, JSON.stringify(ex.json));
const bad = await post("/api/extract", { image: "nope" });
console.log("extract (junk):", bad.status, JSON.stringify(bad.json));
