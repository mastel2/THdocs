/** ตัวอย่างร่างสำหรับทดสอบการจัดหน้า — มาจากตัวอย่างประจำแต่ละชนิดในชุดแม่แบบ (ข้อมูลสมมติทั้งหมด) */
import { exampleDraft, type DraftFile } from "@thdocs/core";
import { DEMO_PROFILE, thGovPack } from "@thdocs/templates-thgov";

export const PROFILE = DEMO_PROFILE;

/** วันที่คงที่ ให้ผลทดสอบไม่เปลี่ยนตามวัน */
const DATE = new Date("2026-10-23T03:00:00.000Z");

export const SAMPLES: Record<string, DraftFile> = Object.fromEntries(
  thGovPack.types.map((t) => [t.id, exampleDraft(t, DATE)!]),
);
