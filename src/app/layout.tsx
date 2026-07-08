import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Igloo Broker CRM",
  description: "Telesales CRM & Renewal Reminder System",
  // Chrome's built-in page-translate feature (not an extension, so it
  // survives Incognito) has a known bug where translating a Thai-language
  // page corrupts in-flight fetch() calls with a
  // "String contains non ISO-8859-1 code point" TypeError — it hit our
  // login form's signInWithPassword request. `notranslate` stops Chrome
  // from offering/auto-applying translation on this app at all.
  other: { google: "notranslate" },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="th"
      translate="no"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
