import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "THdocs — ร่างหนังสือราชการและเอกสารระบบคุณภาพด้วย AI",
    short_name: "THdocs",
    description: "ร่างหนังสือราชการไทยและเอกสาร ISO ด้วย AI แล้วจัดรูปแบบตามระเบียบ ดาวน์โหลดเป็น .docx",
    lang: "th",
    dir: "ltr",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#f3f4f6",
    theme_color: "#1d4ed8",
    categories: ["productivity", "business", "utilities"],
    icons: [
      { src: "/icons/192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-192", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/maskable-512", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
