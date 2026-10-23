import type { Metadata } from "next";
import { Sarabun } from "next/font/google";
import "./globals.css";

const sarabun = Sarabun({ subsets: ["thai", "latin"], weight: ["400", "700"], variable: "--font-sarabun", display: "swap" });

export const metadata: Metadata = {
  title: "THdocs",
  description: "ร่างหนังสือราชการไทยด้วย AI แล้วจัดรูปแบบตามระเบียบงานสารบรรณ",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th" className={sarabun.variable}>
      <body>{children}</body>
    </html>
  );
}
