import type { z } from "zod";
import type { DocIR } from "./ir";

/** ข้อมูลหน่วยงาน/ผู้ใช้ที่กรอกครั้งเดียวแล้วใช้ซ้ำ */
export interface OrgProfile {
  orgName: string;
  /** ชื่อส่วนงานเจ้าของเรื่อง เช่น "กองคลัง" */
  unit: string;
  /** ที่ตั้ง แยกบรรทัด (บรรทัดแรก = ชื่อส่วนราชการ/หน่วยงาน) */
  address: string[];
  phone?: string;
  email?: string;
  /** รหัสตัวพยัญชนะ+เลขประจำเจ้าของเรื่อง เช่น "ศธ ๐๒๐๑" — เลขทะเบียนส่งเติมภายหลัง */
  docNoPrefix?: string;
  signer?: { name: string; position: string[] };
  /** คำเรียกส่วนงานในบันทึกข้อความ: ราชการ = "ส่วนราชการ", เอกชน/รัฐวิสาหกิจบางแห่ง = "หน่วยงาน" */
  unitLabel?: string;
  /** ไฟล์ตรา (PNG) ของหน่วยงาน — ระบบไม่มีตราครุฑให้ ผู้ใช้ต้องจัดหาเอง */
  emblemPng?: string;
}

export type Speed = "ด่วนที่สุด" | "ด่วนมาก" | "ด่วน";
export type Secrecy = "ลับที่สุด" | "ลับมาก" | "ลับ";

export interface DraftOptions {
  speed?: Speed;
  secrecy?: Secrecy;
  /** วันที่ลงในหนังสือ (ไม่ระบุ = วันนี้) */
  date?: Date;
  thaiDigits?: boolean;
}

export interface Context {
  profile: OrgProfile;
  options: DraftOptions;
}

/** ข้อมูลที่ต้องได้จากผู้ใช้ก่อนร่าง — ถ้าขาดตัวที่ required ระบบจะถามกลับ ไม่ให้ AI เดา */
export interface FactSpec {
  key: string;
  question: string;
  required: boolean;
  example?: string;
}

export type Facts = Record<string, string | null>;

export type Level = "error" | "warning" | "info";

export interface Finding {
  level: Level;
  rule: string;
  message: string;
  where?: string;
  /** แหล่งอ้างอิง เช่น ข้อของระเบียบ */
  ref?: string;
}

export type Rule<D> = (doc: D, ctx: Context) => Finding[];

/** ตัวอย่างประจำชนิดเอกสาร — ให้ผู้ใช้เห็นภาพก่อนเริ่ม และใช้เป็นข้อมูลทดสอบผังหน้า */
export interface DocExample<W> {
  /** คำขอตัวอย่างแบบที่ผู้ใช้ควรพิมพ์ */
  request: string;
  facts: Facts;
  wording: W;
  options?: Pick<DraftOptions, "speed" | "secrecy">;
}

/**
 * นิยามชนิดเอกสารหนึ่งชนิด
 *   W = ถ้อยคำที่ AI เขียน (ตรวจด้วย wordingSchema)
 *   D = เอกสารฉบับเต็ม = ถ้อยคำ + ข้อมูลจากผู้ใช้/โปรไฟล์ ที่ระบบเติมแบบ deterministic
 */
export interface DocTypeDef<W = unknown, D = unknown> {
  id: string;
  pack: string;
  name: string;
  description: string;
  facts: FactSpec[];
  /** schema ถ้อยคำที่ให้ AI เติม — ทุก field ต้อง required (ใช้ nullable แทน optional) */
  wordingSchema: z.ZodType<W>;
  /** แนวทางการเขียนสำหรับ AI */
  guidance: string;
  assemble(wording: W, facts: Facts, ctx: Context): D;
  rules: Rule<D>[];
  layout(doc: D, ctx: Context): DocIR;
  example?: DocExample<W>;
}

/** ชุดแม่แบบ เช่น หนังสือราชการ, ISO */
export interface TemplatePack {
  id: string;
  name: string;
  types: DocTypeDef<any, any>[];
  /** ข้อมูลหน่วยงานสมมติ ใช้กับตัวอย่างเมื่อผู้ใช้ยังไม่ได้กรอกของตัวเอง */
  demoProfile?: OrgProfile;
}
