/**
 * LIBRARY_STORE — Offline Store & POS Management System
 */

import type { Metadata, Viewport } from "next";
import { Cairo } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

// Cairo — Arabic/Latin UI font, SELF-HOSTED at build time via next/font (the
// packaged Tauri CSP blocks external font origins, so the app must not depend
// on fonts.googleapis.com). Exposed as the --font-cairo CSS variable.
const cairo = Cairo({
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-cairo",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Library Store — نظام إدارة المتاجر والمكتبات",
  description:
    "Library Store — نظام إدارة المتاجر ونقاط البيع والمخزون بنمط أوفلاين كامل دون اتصال بالإنترنت",
  keywords: ["Library Store", "مكتبة", "متجر", "سوبرماركت", "نقطة بيع", "POS", "مخزون"],
  authors: [{ name: "Library Store" }],
  icons: {
    icon: "/logo.png",
    shortcut: "/favicon.ico",
    apple: "/logo.png",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#080f16" },
    { media: "(prefers-color-scheme: light)", color: "#f7f9fa" },
  ],
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ar"
      dir="rtl"
      className={`${cairo.variable} dark`}
      suppressHydrationWarning
    >
      <head>
        <style
          dangerouslySetInnerHTML={{
            __html: `html.dark,html.dark body{background-color:#080f16!important;color:#e1eaec!important;color-scheme:dark!important;}html:not(.dark),html:not(.dark) body{background-color:#f7f9fa!important;color:#1c262d!important;color-scheme:light!important;}`,
          }}
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('library-theme')||localStorage.getItem('qx-theme');var l=localStorage.getItem('library-lang')||'ar';if(t){document.documentElement.classList.toggle('dark',t==='dark');}document.documentElement.setAttribute('dir',l==='ar'?'rtl':'ltr');document.documentElement.setAttribute('lang',l);}catch(e){}})();`,
          }}
        />
      </head>
      <body className="antialiased bg-background text-foreground min-h-screen">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
