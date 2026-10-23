import type { z } from "zod";
import type { DocIR } from "./ir";

/** ระยะขอบกระดาษ (ซม.) */
export interface Margins {
  topCm: number;
  bottomCm: number;
  leftCm: number;
  rightCm: number;
  /** ระยะหัวกระดาษจากขอบบน */
  headerCm: number;
}

/** ค่าหน้ากระดาษของชุดแม่แบบ: ค่าตั้งต้น + ช่องที่เป็นมาตรฐาน (ตัวตรวจเตือนถ้าปรับต่าง) + ที่มา */
export interface PageStandard {
  margins: Margins;
  /** ช่องที่มีมาตรฐานกำหนดชัด — ช่องอื่นแต่ละหน่วยงานปรับตามแบบของตนได้ */
  standard: (keyof Margins)[];
  note: string;
}

/** ข้อมูลหน่วยงาน/ผู้ใช้ที่กรอกครั้งเดียวแล้วใช้ซ้ำ */
export interface OrgProfile {
  /** ระยะขอบที่หน่วยงานปรับเอง แยกตามชุดแม่แบบ (id ของ TemplatePack) */
  margins?: Record<string, Partial<Margins>>;
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
  page?: PageStandard;
}

const clampCm = (v: unknown, fallback: number) => (typeof v === "number" && Number.isFinite(v) && v >= 0.3 && v <= 8 ? v : fallback);

/** ระยะขอบที่ใช้จริง = ค่าตั้งต้นของชุดแม่แบบ ทับด้วยค่าที่หน่วยงานปรับ (ค่าผิดปกติใช้ค่าตั้งต้น) */
export function marginsFor(pack: string, std: PageStandard, profile: OrgProfile): Margins {
  const o = profile.margins?.[pack] ?? {};
  const m = std.margins;
  return {
    topCm: clampCm(o.topCm, m.topCm),
    bottomCm: clampCm(o.bottomCm, m.bottomCm),
    leftCm: clampCm(o.leftCm, m.leftCm),
    rightCm: clampCm(o.rightCm, m.rightCm),
    headerCm: clampCm(o.headerCm, m.headerCm),
  };
}

/** เตือนเมื่อปรับช่องที่มีมาตรฐานกำหนดให้ต่างจากมาตรฐาน */
export function marginFindings(pack: string, std: PageStandard, profile: OrgProfile, ref: string): Finding[] {
  const used = marginsFor(pack, std, profile);
  const label: Record<keyof Margins, string> = { topCm: "ขอบบน", bottomCm: "ขอบล่าง", leftCm: "ขอบซ้าย", rightCm: "ขอบขวา", headerCm: "ระยะหัวกระดาษ" };
  return std.standard
    .filter((k) => Math.abs(used[k] - std.margins[k]) > 0.05)
    .map((k) => ({ level: "warning" as const, rule: "PAGE_MARGIN", message: `${label[k]} ${used[k]} ซม. ไม่ตรงมาตรฐาน (${std.margins[k]} ซม.)`, where: "profile.margins", ref }));
}
