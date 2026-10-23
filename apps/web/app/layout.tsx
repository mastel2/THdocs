import type { Metadata, Viewport } from "next";
import { Sarabun } from "next/font/google";
import "./globals.css";

const sarabun = Sarabun({ subsets: ["thai", "latin"], weight: ["400", "700"], variable: "--font-sarabun", display: "swap" });

export const metadata: Metadata = {
  title: "THdocs",
  description: "ร่างหนังสือราชการไทยและเอกสารระบบคุณภาพ (ISO) ด้วย AI แล้วจัดรูปแบบตามระเบียบ",
  applicationName: "THdocs",
  icons: { icon: [{ url: "/icons/192", sizes: "192x192", type: "image/png" }], apple: "/icons/apple-180" },
  appleWebApp: { capable: true, title: "THdocs", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#1d4ed8" },
    { media: "(prefers-color-scheme: dark)", color: "#0f1218" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th" className={sarabun.variable}>
      <body>{children}</body>
    </html>
  );
}
