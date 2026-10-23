/**
 * เอกสารเปล่า: ถ้อยคำทุกช่องเป็น "[ระบุ: ชื่อช่อง]" ตาม schema ของชนิดเอกสาร
 * ใช้เป็นฟอร์มเปล่าในเว็บ และเป็นเนื้อของแม่แบบ Word (.dotx) — โครง/ขอบ/สไตล์มาจากแม่แบบเดียวกับเอกสารจริง
 */
import type { DocTypeDef } from "./doctype";
import type { DraftFile } from "./pipeline";
import { toLLMSchema } from "./pipeline";
import { placeholder } from "./thai";

type Node = { type?: string; description?: string; enum?: string[]; properties?: Record<string, Node>; items?: Node; anyOf?: Node[] };

/** ชื่อช่องสำหรับแสดงใน [ระบุ: …] — ข้อความก่อนเครื่องหมาย : ( — ของคำอธิบาย field */
export function fieldLabel(description: string | undefined, fallback: string): string {
  if (!description) return fallback;
  const clean = description.replace(/\s*\([^)]*\)/g, " ").trim();
  const cut = clean.search(/[:—]|\s+เช่น\s/);
  const label = (cut > 0 ? clean.slice(0, cut) : clean).trim();
  return (label.length > 40 ? label.slice(0, 40).trim() : label) || fallback;
}

function fill(n: Node, label: string): unknown {
  if (n.type === "object" && n.properties) {
    return Object.fromEntries(Object.entries(n.properties).map(([k, v]) => [k, fill(v, fieldLabel(v.description, k))]));
  }
  if (n.type === "array") return [fill(n.items ?? {}, label)]; // หนึ่งรายการว่างให้กรอกต่อ
  if (n.enum?.length) return n.enum[0];
  return placeholder(label);
}

export function blankWording(def: DocTypeDef): unknown {
  const wording = fill(toLLMSchema(def.wordingSchema) as Node, def.name) as Record<string, unknown>;
  return wording;
}

/** ไฟล์ร่างเปล่า — ข้อมูลประกอบ (เลขที่ วันที่ ผู้ลงนาม ฯลฯ) ระบบเติมจากโปรไฟล์/ช่อง [ระบุ] ตามปกติ */
export function blankDraft(def: DocTypeDef, options: DraftFile["options"] = {}): DraftFile {
  return { thdocs: 1, type: def.id, facts: {}, wording: blankWording(def), options };
}
