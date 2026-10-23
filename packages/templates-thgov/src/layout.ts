/**
 * ค่าการจัดหน้าหนังสือราชการ — อ้างอิงระเบียบสำนักนายกรัฐมนตรีว่าด้วยงานสารบรรณ
 * และแนวทางการพิมพ์หนังสือราชการ
 *
 * ค่าตำแหน่งที่ระเบียบไม่ได้ให้เป็นตัวเลข (เช่น จุดเริ่มวันที่/คำลงท้าย) เป็นค่าประมาณ
 * ปรับได้ที่นี่ที่เดียว และต้องยืนยันด้วยภาพจาก tools/preview เทียบแบบฟอร์มจริง
 */
import { blank, para, type Block, type Context, type DocIR, type Marking, type PageSetup, type Run } from "@thdocs/core";

export const SPEC = {
  font: "TH SarabunPSK",
  bodyPt: 16,
  margin: { top: 1.5, bottom: 2, left: 3, right: 2 },
  textWidthCm: 16, // 21 - 3 - 2
  emblemLargeCm: 3,
  emblemSmallCm: 1.5,
  firstLineCm: 2.5,
  paraGapPt: 6,
  closingGapPt: 12,
  /** จุดเริ่มบรรทัดวันที่และคำลงท้าย (ประมาณกึ่งกลางหน้า) */
  midCm: 8,
  /** จุดเริ่มที่อยู่ส่วนราชการด้านขวา */
  addressCm: 10,
  /** ระยะข้อความหลังป้าย เรื่อง/เรียน/อ้างถึง และหลัง สิ่งที่ส่งมาด้วย */
  labelCm: 1.25,
  longLabelCm: 2.75,
  /** ขอบซ้ายของคอลัมน์ลงนาม — จัดกลางในช่วงนี้ถึงขอบขวา ให้ชื่อตรงกลางใต้คำลงท้าย (ตรวจด้วย Word แล้ว) */
  signColCm: 2.8,
  signBlankLines: 3,
  memo: { titlePt: 29, labelPt: 20, dateTabCm: 8 },
  red: "C00000",
} as const;

export function pageSetup(ctx: Context): PageSetup {
  return {
    widthCm: 21,
    heightCm: 29.7,
    marginTopCm: SPEC.margin.top,
    marginBottomCm: SPEC.margin.bottom,
    marginLeftCm: SPEC.margin.left,
    marginRightCm: SPEC.margin.right,
    font: SPEC.font,
    sizePt: SPEC.bodyPt,
    thaiDigits: ctx.options.thaiDigits ?? true,
    pageNumbers: true,
  };
}

/** ชั้นความลับ: กลางหัว/ท้ายกระดาษทุกหน้า | ชั้นความเร็ว: ตัวแดง ๓๒ พอยท์ บนซ้ายหน้าแรก */
export function marking(ctx: Context): Marking | undefined {
  const { secrecy, speed } = ctx.options;
  if (!secrecy && !speed) return undefined;
  return {
    ...(secrecy ? { everyPage: [{ text: secrecy, bold: true, sizePt: 20, color: SPEC.red }] } : {}),
    ...(speed ? { firstPageLeft: [{ text: speed, bold: true, sizePt: 32, color: SPEC.red }] } : {}),
  };
}

export function docIR(title: string, ctx: Context, blocks: Block[]): DocIR {
  const m = marking(ctx);
  return { title, page: pageSetup(ctx), ...(m ? { marking: m } : {}), blocks };
}

/** ป้าย + ข้อความ ที่บรรทัดถัดไปเยื้องตรงกับข้อความ เช่น "เรื่อง  ..." */
export function labelled(label: string | Run, text: string, tabCm: number = SPEC.labelCm, spaceBeforePt: number = SPEC.paraGapPt) {
  const l = typeof label === "string" ? { text: label } : label;
  return para([l, { text, tabBefore: true }], {
    tabs: [{ posCm: tabCm }],
    indentLeftCm: tabCm,
    hangingCm: tabCm,
    spaceBeforePt,
  });
}

export function bodyParas(lines: string[]): Block[] {
  return lines.map((t) => para(t, { firstLineCm: SPEC.firstLineCm, align: "thaiDistribute", spaceBeforePt: SPEC.paraGapPt }));
}

export function signature(signer: { name: string; position: string[] }, blankLines: number = SPEC.signBlankLines): Block[] {
  const col = { align: "center" as const, indentLeftCm: SPEC.signColCm };
  return [
    blank(blankLines, true),
    para(`(${signer.name.replace(/^\(|\)$/g, "")})`, { ...col, keepWithNext: signer.position.length > 0 }),
    ...signer.position.map((p, i) => para(p, { ...col, keepWithNext: i < signer.position.length - 1 })),
  ];
}

/** ใส่เลขลำดับ ๑. ๒. เมื่อมีหลายรายการ */
export function numbered(items: string[]): string[] {
  return items.length > 1 ? items.map((t, i) => `${i + 1}. ${t}`) : items;
}

export function stripSalutation(recipient: string): string {
  return recipient.replace(/^\s*(กราบเรียน|เรียน|นมัสการ)\s*/, "").trim();
}
