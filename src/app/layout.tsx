import type { Metadata, Viewport } from "next";
import { Geist, Noto_Sans_Bengali } from "next/font/google";
import { APP_DESCRIPTION_EN, APP_LANG, APP_TITLE } from "@/core/appInfo";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

// Noto Sans Bengali covers the Assamese script (incl. ৰ and ৱ).
const notoBengali = Noto_Sans_Bengali({
  variable: "--font-noto-bengali",
  subsets: ["bengali"],
});

export const metadata: Metadata = {
  title: APP_TITLE,
  description: APP_DESCRIPTION_EN,
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0f766e",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang={APP_LANG}
      className={`${geistSans.variable} ${notoBengali.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
