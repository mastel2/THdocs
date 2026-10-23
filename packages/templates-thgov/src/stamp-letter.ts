/**
 * หนังสือประทับตรา — ระเบียบงานสารบรรณ ข้อ ๑๓–๑๔ (ใช้กระดาษตราครุฑ)
 * ใช้แทนการลงชื่อของหัวหน้าส่วนราชการระดับกรมขึ้นไป เฉพาะเรื่องที่ไม่ใช่เรื่องสำคัญ
 * ตราชื่อส่วนราชการประทับด้วยหมึกแดง และผู้รับผิดชอบลงชื่อย่อกำกับตรา — ระบบเว้นที่ไว้ให้
 */
import { blank, para, type Block, type DocTypeDef, type Finding } from "@thdocs/core";
import { z } from "zod";
import { COMMON_FACTS, ISSUER_FACT, PACK, checkDate, checkDocNo, dateOf, docNoOf, issuerOf, recipientOf } from "./common";
import { SPEC, bodyParas, docIR, labelled } from "./layout";

export const StampLetterWording = z.object({
  paragraphs: z.array(z.string()).describe("ข้อความ: สั้น ตรงประเด็น แต่ละข้อคือหนึ่งย่อหน้า ปิดท้ายด้วยความประสงค์ เช่น 'จึงเรียนมาเพื่อโปรดทราบ'"),
});
export type StampLetterWording = z.infer<typeof StampLetterWording>;

export interface StampLetter extends StampLetterWording {
  docNo: string;
  recipient: string;
  issuer: string;
  date: string;
  unit: string;
  phone: string;
}

const REF = (n: string) => `ระเบียบงานสารบรรณ ข้อ ๑๔.${n}`;

export const stampLetter: DocTypeDef<StampLetterWording, StampLetter> = {
  id: "stamp_letter",
  pack: PACK,
  name: "หนังสือประทับตรา",
  description: "หนังสือที่ใช้ตราประทับแทนการลงชื่อ สำหรับเรื่องไม่สำคัญ เช่น ขอรายละเอียดเพิ่ม ส่งสำเนา ตอบรับทราบ เตือนเรื่องค้าง",
  facts: [
    { key: "recipient", question: "ถึงใคร (ส่วนราชการ/หน่วยงาน/บุคคล)", required: true, example: "สำนักงานคณะกรรมการข้าราชการพลเรือน" },
    { key: "purpose", question: "เรื่องที่ต้องการแจ้ง", required: true, example: "ส่งสำเนาคำสั่งแต่งตั้งคณะกรรมการ" },
    { key: "details", question: "รายละเอียด (ถ้ามี)", required: false },
    ISSUER_FACT,
    ...COMMON_FACTS.filter((f) => !f.key.startsWith("signer")),
  ],
  wordingSchema: StampLetterWording,
  guidance: [
    "หนังสือประทับตราไม่มีคำขึ้นต้น คำลงท้าย และลายมือชื่อ — เขียนเฉพาะข้อความ",
    "ข้อความสั้นและตรงประเด็น เพราะใช้กับเรื่องที่ไม่ใช่เรื่องสำคัญ",
  ].join("\n"),
  example: {
    request: "แจ้งสำนักงานจังหวัดตัวอย่างว่าส่งสำเนาคำสั่งแต่งตั้งคณะกรรมการจัดซื้อจัดจ้าง 1 ฉบับมาเพื่อทราบ",
    facts: { recipient: "สำนักงานจังหวัดตัวอย่าง", docNo: "ตย 0001/ว 45" },
    wording: {
      paragraphs: [
        "สำนักงานตัวอย่างขอส่งสำเนาคำสั่งสำนักงานตัวอย่าง ที่ 120/2569 เรื่อง แต่งตั้งคณะกรรมการจัดซื้อจัดจ้าง จำนวน 1 ฉบับ มาเพื่อโปรดทราบ",
      ],
    },
  },

  assemble(w, facts, ctx) {
    const p = ctx.profile;
    return {
      ...w,
      docNo: docNoOf(facts, ctx),
      recipient: recipientOf(facts),
      issuer: issuerOf(facts, ctx),
      date: dateOf(facts, ctx),
      unit: p.unit,
      phone: p.phone || "[ระบุ: โทรศัพท์]",
    };
  },

  rules: [
    (d) => checkDocNo(d.docNo, REF("๑")),
    (d) => checkDate(d.date, REF("๖"), false),
    (d): Finding[] =>
      d.paragraphs.join("").length > 1000
        ? [{ level: "info", rule: "STAMP_SCOPE", message: "หนังสือประทับตราใช้เฉพาะเรื่องไม่สำคัญ — ถ้าเนื้อหายาวหรือสำคัญ ควรใช้หนังสือภายนอก", ref: "ระเบียบงานสารบรรณ ข้อ ๑๓" }]
        : [],
  ],

  layout(d, ctx) {
    const blocks: Block[] = [
      { kind: "emblem", heightCm: SPEC.emblemLargeCm, placement: "center" },
      para(`ที่ ${d.docNo}`),
      labelled("ถึง", d.recipient),
      ...bodyParas(d.paragraphs),
      para(d.issuer, { indentLeftCm: SPEC.midCm, spaceBeforePt: SPEC.closingGapPt, keepWithNext: true }),
      blank(3, true), // ที่ประทับตราหมึกแดง + ลงชื่อย่อกำกับตรา
      para(d.date, { indentLeftCm: SPEC.midCm }),
      blank(2),
      para(d.unit),
      para(`โทร. ${d.phone}`),
    ];
    return docIR(`หนังสือประทับตรา — ${d.recipient}`, ctx, blocks);
  },
};
