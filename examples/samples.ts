/** ตัวอย่างร่างสำหรับทดสอบการจัดหน้า — มาจากตัวอย่างประจำแต่ละชนิดในชุดแม่แบบ (ข้อมูลสมมติทั้งหมด) */
import { exampleDraft, type DraftFile, type TemplatePack } from "@thdocs/core";
import { isoPack } from "@thdocs/templates-iso";
import { DEMO_PROFILE, thGovPack } from "@thdocs/templates-thgov";

export const PROFILE = DEMO_PROFILE;

/** วันที่คงที่ ให้ผลทดสอบไม่เปลี่ยนตามวัน */
const DATE = new Date("2026-10-23T03:00:00.000Z");

const samplesOf = (pack: TemplatePack): Record<string, DraftFile> =>
  Object.fromEntries(pack.types.map((t) => [t.id, exampleDraft(t, DATE)!]));

/** หนังสือราชการ — ใช้กับ PROFILE */
export const SAMPLES = samplesOf(thGovPack);

/** เอกสารระบบคุณภาพ — ใช้กับ isoPack.demoProfile */
export const ISO_SAMPLES = samplesOf(isoPack);

export const PACKS = [thGovPack, isoPack];
