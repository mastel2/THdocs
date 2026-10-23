import type { Metadata } from "next";
import { Studio } from "../../components/Studio";

export const metadata: Metadata = { title: "THdocs สำหรับ Word" };

/** แผงข้างใน Word — โหลดผ่าน manifest (/addin/manifest.xml); office.js โหลดใน lib/office.ts หลังหน้าพร้อม */
export default function AddinPage() {
  return <Studio variant="addin" />;
}
