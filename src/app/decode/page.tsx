// /decode: paste a rejection or payment-status message → one known reason + fix steps (Assamese + English).
// Static shell; the client component calls /api/decode. No photo upload here (text only).
import type { Metadata } from "next";
import { DecodeApp } from "./DecodeApp";

export const metadata: Metadata = { title: "Decode a rejection · KaagazCheck" };

export default function DecodePage() {
  return <DecodeApp />;
}
