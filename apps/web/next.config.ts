import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

const config: NextConfig = {
  // แพ็กเกจในโปรเจกต์ส่งออกเป็น TypeScript ให้ Next แปลงเอง
  transpilePackages: ["@thdocs/core", "@thdocs/llm", "@thdocs/render-docx", "@thdocs/render-html", "@thdocs/templates-thgov", "@thdocs/templates-iso"],
  poweredByHeader: false,
  // ชุดไฟล์เดี่ยวสำหรับ Docker (ติดตั้งเองบนเซิร์ฟเวอร์) — ชี้รากของ monorepo เพื่อรวมแพ็กเกจในโปรเจกต์
  output: "standalone",
  outputFileTracingRoot: fileURLToPath(new URL("../..", import.meta.url)),
};

export default config;
