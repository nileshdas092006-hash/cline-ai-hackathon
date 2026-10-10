// Server component: builds the scheme catalog from the registry and hands plain data to the client flow.
// The catalog is read at request time (not prerendered), so a rule version published in /admin
// shows up for citizens at once.
import { connection } from "next/server";
import { Suspense } from "react";
import { catalogOf } from "@/core/catalog";
import { SAMPLES } from "@/core/samples";
import { listSchemes } from "@/core/schemes";
import { getRuleService } from "@/server/rules";
import { KaagazApp } from "./_components/KaagazApp";

async function LiveApp() {
  await connection();
  getRuleService().syncRegistry();
  return <KaagazApp catalog={catalogOf(listSchemes())} samples={Object.values(SAMPLES)} />;
}

export default function Home() {
  return (
    <Suspense fallback={<p className="p-6 text-center text-zinc-600">…</p>}>
      <LiveApp />
    </Suspense>
  );
}
