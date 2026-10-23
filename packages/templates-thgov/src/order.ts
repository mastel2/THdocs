/** คำสั่ง — ระเบียบงานสารบรรณ ข้อ ๑๖ (ใช้กระดาษตราครุฑ) */
import { placeholder, type Block, type DocTypeDef, type Finding } from "@thdocs/core";
import { z } from "zod";
import { COMMON_FACTS, ISSUER_FACT, PACK, checkDate, dateOf, issuerOf, signerOf, yearBE, type Signer } from "./common";
import { SPEC, bodyParas, centered, dateLine, docIR, separator, signature } from "./layout";

export const OrderWording = z.object({
  subject: z.string().describe("เรื่อง: ใจความย่อ เช่น 'แต่งตั้งคณะกรรมการ...'"),
  paragraphs: z.array(z.string()).describe("ข้อความ: เหตุที่ออกคำสั่ง → อำนาจที่ใช้ (ถ้าผู้ใช้ให้มา) → สิ่งที่สั่ง แยกย่อหน้า; รายชื่อ/หน้าที่ให้เป็นย่อหน้าละรายการ"),
  effective: z.string().describe("วันใช้บังคับ เช่น 'ทั้งนี้ ตั้งแต่บัดนี้เป็นต้นไป' หรือ 'ทั้งนี้ ตั้งแต่วันที่ ...'"),
});
export type OrderWording = z.infer<typeof OrderWording>;

export interface Order extends OrderWording {
  issuer: string;
  docNo: string;
  date: string;
  signer: Signer;
}

const REF = (n: string) => `ระเบียบงานสารบรรณ ข้อ ๑๖.${n}`;

export const order: DocTypeDef<OrderWording, Order> = {
  id: "order",
  pack: PACK,
  name: "คำสั่ง",
  description: "บรรดาข้อความที่ผู้บังคับบัญชาสั่งการให้ปฏิบัติโดยชอบด้วยกฎหมาย เช่น แต่งตั้งคณะกรรมการ มอบหมายงาน",
  facts: [
    { key: "purpose", question: "สั่งเรื่องอะไร", required: true, example: "แต่งตั้งคณะกรรมการตรวจรับพัสดุ" },
    { key: "details", question: "รายละเอียด เช่น รายชื่อและตำแหน่ง หน้าที่ วันเริ่ม", required: false },
    { key: "authority", question: "อำนาจตามกฎหมาย/ระเบียบที่ใช้สั่ง (ถ้ามี)", required: false },
    ISSUER_FACT,
    ...COMMON_FACTS,
  ],
  wordingSchema: OrderWording,
  guidance: [
    "ลำดับข้อความ: เหตุที่ออกคำสั่ง → อาศัยอำนาจ (ใช้เฉพาะที่ผู้ใช้ระบุ ห้ามแต่งเลขมาตรา/ข้อ) → สิ่งที่สั่งให้ปฏิบัติ",
    "ภาษาสั่งการ เช่น 'จึงแต่งตั้ง...', 'ให้...ปฏิบัติหน้าที่...'",
    "ไม่ต้องเขียนหัวคำสั่ง เลขที่ วันที่สั่ง หรือผู้ลงนาม",
  ].join("\n"),
  example: {
    request: "แต่งตั้งคณะกรรมการตรวจรับพัสดุโครงการจัดซื้อคอมพิวเตอร์ 3 คน คือ นายตัวอย่าง หนึ่ง ประธาน นางตัวอย่าง สอง กรรมการ นางสาวตัวอย่าง สาม กรรมการและเลขานุการ",
    facts: { docNo: "120/2569" },
    wording: {
      subject: "แต่งตั้งคณะกรรมการตรวจรับพัสดุ",
      paragraphs: [
        "ด้วยสำนักงานตัวอย่างดำเนินการจัดซื้อเครื่องคอมพิวเตอร์ จำนวน 8 เครื่อง เพื่อให้การตรวจรับพัสดุเป็นไปด้วยความเรียบร้อย จึงแต่งตั้งคณะกรรมการตรวจรับพัสดุ ประกอบด้วย",
        "1. นายตัวอย่าง หนึ่ง ประธานกรรมการ",
        "2. นางตัวอย่าง สอง กรรมการ",
        "3. นางสาวตัวอย่าง สาม กรรมการและเลขานุการ",
        "ให้คณะกรรมการมีหน้าที่ตรวจรับพัสดุให้ถูกต้องครบถ้วนตามสัญญา แล้วรายงานผลต่อผู้อำนวยการสำนักงานตัวอย่าง",
      ],
      effective: "ทั้งนี้ ตั้งแต่บัดนี้เป็นต้นไป",
    },
  },

  assemble(w, facts, ctx) {
    return {
      ...w,
      issuer: issuerOf(facts, ctx),
      docNo: facts.docNo?.trim() || `${placeholder("เลขที่คำสั่ง")}/${yearBE(ctx)}`,
      date: dateOf(facts, ctx, true),
      signer: signerOf(facts, ctx),
    };
  },

  rules: [
    (d) => checkDate(d.date, REF("๕"), true),
    (d): Finding[] =>
      /^.+\/\s*[0-9๐-๙]{4}$/.test(d.docNo)
        ? []
        : [{ level: "error", rule: "ORDER_NO", message: "ที่ ของคำสั่งต้องเป็น 'เลขที่/ปีพุทธศักราช' (เริ่มเลข ๑ ใหม่ทุกปีปฏิทิน)", where: "docNo", ref: REF("๒") }],
    (d): Finding[] => (d.effective.trim() ? [] : [{ level: "warning", rule: "ORDER_EFFECTIVE", message: "ระบุวันใช้บังคับ", where: "wording.effective", ref: REF("๔") }]),
  ],

  layout(d, ctx) {
    const blocks: Block[] = [
      { kind: "emblem", heightCm: SPEC.emblemLargeCm, placement: "center" },
      centered(`คำสั่ง${d.issuer}`, { bold: true }),
      centered(`ที่ ${d.docNo}`),
      centered(`เรื่อง ${d.subject}`),
      separator(),
      ...bodyParas([...d.paragraphs, d.effective]),
      dateLine("สั่ง ณ วันที่", d.date),
      ...signature(d.signer),
    ];
    return docIR(`คำสั่ง — ${d.subject}`, ctx, blocks);
  },
};
