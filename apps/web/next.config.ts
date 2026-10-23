import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

/**
 * Content-Security-Policy — connect-src เปิด http/https เพราะโหมด BYOK/AI ในเครื่องให้เบราว์เซอร์เรียกผู้ให้บริการ
 * หรือ Ollama (localhost) โดยตรง จึงจำกัดปลายทางล่วงหน้าไม่ได้ ส่วนอื่นปิดให้แคบที่สุด
 * หน้า /addin ไม่ใส่ CSP เพราะ office.js ของ Microsoft โหลดสคริปต์เพิ่มเองหลายโดเมน
 */
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self' http: https:",
  "worker-src 'self'",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const COMMON = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "no-referrer" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  { key: "Strict-Transport-Security", value: "max-age=15552000" },
];

const config: NextConfig = {
  // แพ็กเกจในโปรเจกต์ส่งออกเป็น TypeScript ให้ Next แปลงเอง
  transpilePackages: ["@thdocs/core", "@thdocs/llm", "@thdocs/render-docx", "@thdocs/render-html", "@thdocs/templates-thgov", "@thdocs/templates-iso"],
  poweredByHeader: false,
  // ชุดไฟล์เดี่ยวสำหรับ Docker (ติดตั้งเองบนเซิร์ฟเวอร์) — ชี้รากของ monorepo เพื่อรวมแพ็กเกจในโปรเจกต์
  output: "standalone",
  outputFileTracingRoot: fileURLToPath(new URL("../..", import.meta.url)),
  async headers() {
    return [
      // ทุกหน้ายกเว้น /addin (ไม่ใส่ CSP และไม่ห้ามฝัง เพราะ Office แสดงในแผงของ Word)
      { source: "/((?!addin).*)", headers: [...COMMON, { key: "Content-Security-Policy", value: CSP }, { key: "X-Frame-Options", value: "DENY" }] },
      { source: "/addin", headers: COMMON },
    ];
  },
};

export default config;
