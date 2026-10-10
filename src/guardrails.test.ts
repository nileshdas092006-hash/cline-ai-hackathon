// Guardrails audit (T4). Each trust rule has a test here or points to the test that covers it.
// The UI parts render the real report components to static HTML (no browser needed).
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import fc from "fast-check";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CheckItem } from "@/app/_components/CheckItem";
import { CoverSheet } from "@/app/_components/CoverSheet";
import { ReportStep } from "@/app/_components/ReportStep";
import { catalogOf } from "@/core/catalog";
import { evaluate } from "@/core/evaluate";
import { DISCLAIMER } from "@/core/labels";
import { SAMPLES } from "@/core/samples";
import { getScheme, listSchemes } from "@/core/schemes";
import { ExtractedDoc, type Report } from "@/core/types";
import { STRINGS, type Lang } from "@/i18n";

const AS_OF = "2026-10-10";
const LANGS: Lang[] = ["as", "en"];
const SRC = join(process.cwd(), "src");

/** Same escaping as React's static renderer, so expected text can be found in the HTML. */
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#x27;");

const catalog = catalogOf(listSchemes());
const samples = Object.values(SAMPLES).map((s) => {
  const report = evaluate(getScheme(s.schemeId)!, s.docs, s.answers, AS_OF);
  return { sample: s, report, view: catalog.find((v) => v.id === s.schemeId)! };
});

function sourceFiles(dir = SRC): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return sourceFiles(p);
    return /\.(ts|tsx)$/.test(name) && !/\.test\.ts$/.test(name) ? [p] : [];
  });
}
const rel = (p: string) => relative(SRC, p).split(sep).join("/");
const files = sourceFiles().map((p) => ({ path: rel(p), text: readFileSync(p, "utf8") }));
const file = (path: string) => files.find((f) => f.path === path)!.text;

describe("guardrail: Aadhaar is masked (UI, logs, print)", () => {
  it("documents can only hold the last 4 Aadhaar digits (schema used by the UI and the API)", () => {
    const doc = (aadhaarLast4: string) => ExtractedDoc.safeParse({ docType: "aadhaar", fields: { aadhaarLast4 }, confidence: {} });
    expect(doc("4821").success).toBe(true);
    for (const bad of ["123456784821", "1234 5678 4821", "48211", "48a1"]) expect(doc(bad).success, bad).toBe(false);
  });

  it("the printed cover sheet shows XXXX XXXX + last 4 and never a 12-digit number or the account number", () => {
    const { sample, report, view } = samples.find((s) => s.sample.id === "A")!;
    const accountNo = sample.docs.find((d) => d.fields.accountNo)?.fields.accountNo;
    expect(accountNo).toBeTruthy();
    for (const lang of LANGS) {
      const html = renderToStaticMarkup(createElement(CoverSheet, { lang, scheme: view, report, docs: sample.docs, sampleId: "A" }));
      expect(html).toContain("XXXX XXXX 4821");
      expect(html).not.toMatch(/\d{4}\s?\d{4}\s?\d{4}/);
      expect(html).not.toContain(accountNo!);
    }
  });

  it("logs: only ai.ts logs, through the typed AiLogEntry (model / prompt version / input hash / outcome)", () => {
    // ai.test.ts and decode.test.ts also check that log entries hold no names, digits or keys.
    expect(file("server/ai.ts").match(/console\.\w+\(/g)).toEqual(["console.info("]);
    expect(file("server/ai.ts")).toMatch(/const defaultLog = \(entry: AiLogEntry\)/);
    const others = files.filter((f) => f.path !== "server/ai.ts" && /console\.(log|info|warn|error|debug)\(/.test(f.text));
    expect(others.map((f) => f.path)).toEqual([]);
  });
});

describe("guardrail: no images are stored", () => {
  it("no app code writes files; browser storage holds only the admin passcode; only store.ts opens SQLite", () => {
    const writers = files.filter((f) => /\b(writeFile|writeFileSync|appendFile|appendFileSync|createWriteStream)\b/.test(f.text));
    expect(writers.map((f) => f.path)).toEqual([]);
    const storage = files.filter((f) => /\b(localStorage|sessionStorage|indexedDB)\b/.test(f.text)).map((f) => f.path);
    expect(storage).toEqual(["app/admin/passcode.ts"]);
    expect(files.filter((f) => /node:sqlite/.test(f.text)).map((f) => f.path)).toEqual(["server/store.ts"]);
  });

  it("the only table holds rule versions; it has no image, photo or Aadhaar column", () => {
    const store = file("server/store.ts");
    expect(store.match(/CREATE TABLE/g)).toHaveLength(1);
    expect(store).toMatch(/CREATE TABLE IF NOT EXISTS rule_versions/);
    expect(store).not.toMatch(/image|photo|blob|aadhaar/i);
  });
});

describe("guardrail: every AI output is zod-validated, in one module", () => {
  it("only src/server/ai.ts calls a model (chat completions or the Cline SDK Agent)", () => {
    const callers = files.filter((f) => /chat\/completions|new Agent\(|import\("@cline\/sdk"\)/.test(f.text)).map((f) => f.path);
    expect(callers).toEqual(["server/ai.ts"]);
  });

  it("each model reply goes through a zod safeParse before use; agent tools re-validate their input", () => {
    expect(file("server/ai.ts")).toMatch(/RawExtraction\.safeParse\(jsonFromReply/);
    expect(file("server/ai.ts")).toMatch(/RawClassification\.safeParse\(jsonFromReply/);
    expect(file("server/agents/ruleMaintenance.ts")).toMatch(/safeParse/);
  });
});

describe("guardrail: the report always carries the disclaimer, and every check its provenance", () => {
  it.each(samples.map((s) => [s.sample.id, s] as const))("sample %s: disclaimer footer on screen and in print, both languages", (_id, s) => {
    for (const lang of LANGS) {
      const screen = renderToStaticMarkup(
        createElement(ReportStep, { lang, scheme: s.view, state: { status: "done", report: s.report }, onRetry: () => {}, onStartOver: () => {} }),
      );
      const print = renderToStaticMarkup(createElement(CoverSheet, { lang, scheme: s.view, report: s.report, docs: s.sample.docs, sampleId: s.sample.id }));
      for (const html of [screen, print]) {
        expect(html).toContain(esc(DISCLAIMER.as));
        expect(html).toContain(esc(DISCLAIMER.en));
        expect(html).toMatch(/<footer/);
      }
    }
  });

  it("every check shows its source, the 'verified on' date and (only if provisional) the provisional badge", () => {
    let provisionalSeen = 0;
    for (const { report } of samples) {
      for (const check of report.checks) {
        for (const lang of LANGS) {
          const t = STRINGS[lang].report;
          const html = renderToStaticMarkup(createElement("ul", null, createElement(CheckItem, { lang, check })));
          const p = check.provenance;
          expect(html, check.id).toContain(esc(p.sourceTitle));
          expect(html, check.id).toContain(esc(t.verifiedOn(p.verifiedOn)));
          expect(html.includes(esc(t.provisional)), check.id).toBe(p.status === "provisional");
          if (p.sourceUrl) expect(html).toContain(`href="${esc(p.sourceUrl)}"`);
          else expect(html).toContain(esc(t.noSourceLink));
        }
        if (check.provenance.status === "provisional") provisionalSeen++;
      }
    }
    expect(provisionalSeen).toBeGreaterThan(0); // the badge path is really exercised
  });

  it("the cover sheet also prints source + 'verified on' (+ provisional) for every listed check", () => {
    const s = samples.find((x) => x.sample.id === "B")!;
    const html = renderToStaticMarkup(createElement(CoverSheet, { lang: "en", scheme: s.view, report: s.report, docs: s.sample.docs, sampleId: "B" }));
    const listed = s.report.checks.filter((c) => c.result === "action_required" || c.result === "needs_verification");
    expect(listed.length).toBeGreaterThan(0);
    for (const c of listed) {
      expect(html).toContain(esc(`${STRINGS.en.report.source}: ${c.provenance.sourceTitle}`));
      expect(html).toContain(esc(STRINGS.en.report.verifiedOn(c.provenance.verifiedOn)));
    }
  });

  it("property: every report from the engine has the bilingual disclaimer", () => {
    fc.assert(
      fc.property(fc.constantFrom(...samples), fc.boolean(), ({ sample }, flip) => {
        const answers = Object.fromEntries(Object.entries(sample.answers).map(([k, v]) => [k, flip ? !v : v]));
        const r: Report = evaluate(getScheme(sample.schemeId)!, sample.docs, answers, AS_OF);
        return r.disclaimerEn === DISCLAIMER.en && r.disclaimerAs === DISCLAIMER.as;
      }),
      { numRuns: 50 },
    );
  });
});

describe("guardrail: a fuzzy name score never yields ok", () => {
  it("in samples A/B/C only a `same` name match is ok (the fast-check property is in evaluate.test.ts)", () => {
    const nameChecks = samples.flatMap((s) => s.report.checks.filter((c) => c.kind === "name" && c.match));
    expect(nameChecks.some((c) => c.match!.level !== "same")).toBe(true); // sample B: a possible match + a mismatch
    for (const c of nameChecks) expect(c.result === "ok", c.id).toBe(c.match!.level === "same");
  });
});

