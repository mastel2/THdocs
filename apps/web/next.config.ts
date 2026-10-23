import type { NextConfig } from "next";

const config: NextConfig = {
  // แพ็กเกจในโปรเจกต์ส่งออกเป็น TypeScript ให้ Next แปลงเอง
  transpilePackages: ["@thdocs/core", "@thdocs/llm", "@thdocs/render-docx", "@thdocs/render-html", "@thdocs/templates-thgov"],
  poweredByHeader: false,
};

export default config;
