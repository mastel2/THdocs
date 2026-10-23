/**
 * Document IR — ผังเอกสารที่ไม่ผูกกับรูปแบบไฟล์
 *
 * ชุดแม่แบบ (template pack) แปลงเนื้อหาเป็น IR ชุดเดียว แล้วตัวแสดงผลแต่ละตัว
 * (.docx ตอนนี้; Google Docs / Office.js ภายหลัง) แปลง IR เป็นปลายทางของตัวเอง
 * หน่วยความยาว: ซม. (cm) และพอยท์ (pt) ตามที่แนวทางการพิมพ์ใช้
 */

export type Align = "left" | "center" | "right" | "justify" | "thaiDistribute";

export interface Run {
  text: string;
  bold?: boolean;
  sizePt?: number;
  color?: string; // hex ไม่มี # เช่น "C00000"
  /** แทรก tab ก่อนข้อความนี้ */
  tabBefore?: boolean;
  /** ฟิลด์ที่โปรแกรมคำนวณเอง (ใช้ต่อท้ายข้อความ เช่น "หน้า " + page + " / " + pages) */
  field?: "page" | "pages";
}

export interface TabStop {
  posCm: number;
  align?: "left" | "center" | "right";
}

export interface Para {
  kind: "para";
  runs: Run[];
  align?: Align;
  indentLeftCm?: number;
  firstLineCm?: number;
  hangingCm?: number;
  spaceBeforePt?: number;
  spaceAfterPt?: number;
  tabs?: TabStop[];
  /** ให้อยู่หน้าเดียวกับย่อหน้าถัดไป (กันส่วนลงนามแยกหน้า) */
  keepWithNext?: boolean;
}

export interface Emblem {
  kind: "emblem";
  heightCm: number;
  /** center = กลางหน้า บนสุด; left-float = ลอยชิดซ้ายในบรรทัดหัวบันทึกข้อความ */
  placement: "center" | "left-float";
}

export interface Blank {
  kind: "blank";
  lines: number;
  keepWithNext?: boolean;
}

/** เส้นคั่นกลางหน้า เช่น ใต้หัวคำสั่ง/ระเบียบ/ประกาศ */
export interface Separator {
  kind: "rule";
  widthCm: number;
  spaceBeforePt?: number;
  spaceAfterPt?: number;
}

export interface Cell {
  paras: Para[];
  /** รวมกี่คอลัมน์ */
  span?: number;
  /** สีพื้น hex ไม่มี # */
  shade?: string;
  vAlign?: "top" | "center";
}

/** ตาราง เส้นขอบทุกช่อง — ใช้กับเอกสารระบบคุณภาพ (ตารางควบคุมเอกสาร ขั้นตอน แบบฟอร์ม) */
export interface Table {
  kind: "table";
  columnsCm: number[];
  rows: { cells: Cell[]; header?: boolean }[];
  spaceBeforePt?: number;
  /** ห้ามแยกตารางข้ามหน้า (เช่น ตารางลงนาม — หัวตารางกับช่องลงนามต้องอยู่หน้าเดียวกัน) */
  keepTogether?: boolean;
}

export type Block = Para | Emblem | Blank | Separator | Table;

export interface PageSetup {
  widthCm: number;
  heightCm: number;
  marginTopCm: number;
  marginBottomCm: number;
  marginLeftCm: number;
  marginRightCm: number;
  font: string;
  sizePt: number;
  /** แปลงเลขอารบิกเป็นเลขไทย (ยกเว้น URL และอีเมล) */
  thaiDigits: boolean;
  /** เลขหน้า: กลางหัวกระดาษ เริ่มแสดงหน้า ๒ รูปแบบ "- ๒ -" */
  pageNumbers: boolean;
}

/** เครื่องหมายบนหัว/ท้ายกระดาษ เช่น ชั้นความลับ ชั้นความเร็ว */
export interface Marking {
  /** แสดงกลางหัวและท้ายกระดาษทุกหน้า */
  everyPage?: Run[];
  /** แสดงซ้ายบนหน้าแรกเท่านั้น */
  firstPageLeft?: Run[];
}

export interface DocIR {
  title: string;
  page: PageSetup;
  marking?: Marking;
  /** หัวกระดาษที่ซ้ำทุกหน้า เช่น ตารางควบคุมเอกสาร (ใช้แทนเลขหน้าแบบหนังสือราชการ) */
  header?: Block[];
  blocks: Block[];
}

export const para = (runs: Run[] | string, opts: Omit<Para, "kind" | "runs"> = {}): Para => ({
  kind: "para",
  runs: typeof runs === "string" ? [{ text: runs }] : runs,
  ...opts,
});

export const blank = (lines = 1, keepWithNext = false): Blank => ({ kind: "blank", lines, keepWithNext });

/** ช่องตารางจากข้อความ (ขึ้นบรรทัดใหม่ = ย่อหน้าใหม่) */
export const cell = (text: string | Run[], opts: Omit<Cell, "paras"> & { bold?: boolean; align?: Align } = {}): Cell => {
  const { bold, align, ...rest } = opts;
  const paras =
    typeof text === "string"
      ? text.split("\n").map((t) => para([{ text: t, ...(bold ? { bold } : {}) }], align ? { align } : {}))
      : [para(text, align ? { align } : {})];
  return { paras, ...rest };
};
