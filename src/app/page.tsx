// Server component: builds the scheme catalog from the registry and hands plain data to the client flow.
import { catalogOf } from "@/core/catalog";
import { SAMPLES } from "@/core/samples";
import { listSchemes } from "@/core/schemes";
import { KaagazApp } from "./_components/KaagazApp";

export default function Home() {
  return <KaagazApp catalog={catalogOf(listSchemes())} samples={Object.values(SAMPLES)} />;
}
