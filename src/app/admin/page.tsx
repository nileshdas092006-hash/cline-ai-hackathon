// /admin: the rule maintainer's page (English; helper organisations, not citizens).
// Server component: loads the two demo notices from docs/ and the version history at request
// time, and hands plain data to the client.
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { noticeFromDemoFile } from "@/core/notice";
import { schemeHistories } from "@/server/adminApi";
import { AdminApp, type DemoNotice } from "./AdminApp";

export const metadata: Metadata = { title: "Rule Maintenance Agent · KaagazCheck" };

const DEMOS = [
  { id: "ignoaps", label: "Load demo notice: Old Age Pension (new scheme)", file: "sample-guideline-ignoaps.md" },
  { id: "orunodoi", label: "Load demo notice: Orunodoi October 2026 (one-time ₹1,500)", file: "sample-notice-orunodoi-oct2026.md" },
];

async function loadDemos(): Promise<DemoNotice[]> {
  const out: DemoNotice[] = [];
  for (const d of DEMOS) {
    try {
      const md = await readFile(join(process.cwd(), "docs", d.file), "utf8");
      out.push({ id: d.id, label: d.label, text: noticeFromDemoFile(md) });
    } catch {
      // A missing demo file just hides its button.
    }
  }
  return out;
}

async function LiveAdmin() {
  await connection(); // the history changes whenever someone publishes
  const [demos, history] = await Promise.all([loadDemos(), Promise.resolve(schemeHistories())]);
  return <AdminApp demos={demos} initialHistory={history} />;
}

export default function AdminPage() {
  return (
    <Suspense fallback={<p className="p-6 text-center text-zinc-600">Loading…</p>}>
      <LiveAdmin />
    </Suspense>
  );
}
