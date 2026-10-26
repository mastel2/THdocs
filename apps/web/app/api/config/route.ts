import { providers } from "../../../lib/server";

export const dynamic = "force-dynamic";

/** ลิงก์ซอร์สโค้ดของเวอร์ชันที่รันอยู่ — AGPL-3.0 ข้อ 13 ให้ผู้ใช้ผ่านเครือข่ายเข้าถึงได้ (ต้องเป็น https) */
function sourceUrl(): string | null {
  const u = process.env.THDOCS_SOURCE_URL?.trim() ?? "";
  return u.startsWith("https://") ? u : null;
}

export function GET() {
  return Response.json({ providers: providers(), sourceUrl: sourceUrl() }, { headers: { "Cache-Control": "no-store" } });
}
