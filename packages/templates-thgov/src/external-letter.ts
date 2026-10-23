/** หนังสือภายนอก — ระเบียบงานสารบรรณ ข้อ ๑๑ (ใช้กระดาษตราครุฑ) */
import { blank, para, type Block, type DocTypeDef, type Finding } from "@thdocs/core";
import { z } from "zod";
import { COMMON_FACTS, PACK, checkBody, checkDate, checkDocNo, dateOf, docNoOf, recipientOf, signerOf, type Signer } from "./common";
import { SPEC, bodyParas, docIR, labelled, numbered, signature } from "./layout";
import { pairOk, salutationFor } from "./salutation";

export const ExternalLetterWording = z.object({
  subject: z.string().describe("เรื่อง: ใจความย่อที่สั้นที่สุด"),
  references: z.array(z.string()).describe("อ้างถึง: หนังสือที่ติดต่อกันมาครั้งหลังสุด (ไม่มีให้เป็น [])"),
  attachments: z.array(z.string()).describe("สิ่งที่ส่งมาด้วย พร้อมจำนวน (ไม่มีให้เป็น [])"),
  cause: z.array(z.string()).describe("ภาคเหตุ: ขึ้นต้น 'ด้วย' / 'ตาม' / 'เนื่องจาก' แต่ละข้อคือหนึ่งย่อหน้า"),
  intent: z.array(z.string()).describe("ภาคความประสงค์: สิ่งที่ต้องการให้ผู้รับทำ แต่ละข้อคือหนึ่งย่อหน้า"),
  conclusion: z.string().describe("ภาคสรุป เช่น 'จึงเรียนมาเพื่อโปรดพิจารณา'"),
  copiesTo: z.array(z.string()).describe("สำเนาส่ง (ไม่มีให้เป็น [])"),
});
export type ExternalLetterWording = z.infer<typeof ExternalLetterWording>;

export interface ExternalLetter extends ExternalLetterWording {
  recipient: string;
  docNo: string;
  agency: string[];
  date: string;
  salutation: string;
  closing: string;
  signer: Signer;
  unit: string;
  phone: string;
  email: string | null;
}

const REF = (n: string) => `ระเบียบงานสารบรรณ ข้อ ๑๑.${n}`;

export const externalLetter: DocTypeDef<ExternalLetterWording, ExternalLetter> = {
  id: "external_letter",
  pack: PACK,
  name: "หนังสือภายนอก",
  description: "หนังสือติดต่อราชการที่เป็นแบบพิธี ระหว่างส่วนราชการ หรือถึงหน่วยงาน/บุคคลภายนอก",
  facts: [
    { key: "recipient", question: "ส่งถึงใคร (ตำแหน่ง/หน่วยงาน)", required: true, example: "อธิการบดีมหาวิทยาลัยเกษตรศาสตร์" },
    { key: "purpose", question: "ต้องการให้ผู้รับทำอะไร", required: true, example: "ขอเชิญเป็นวิทยากร" },
    { key: "details", question: "รายละเอียดสำคัญ (วัน เวลา สถานที่ จำนวน งบประมาณ)", required: false },
    { key: "references", question: "หนังสือที่อ้างถึง (ถ้ามี)", required: false },
    { key: "attachments", question: "สิ่งที่ส่งมาด้วย (ถ้ามี)", required: false },
    ...COMMON_FACTS,
  ],
  wordingSchema: ExternalLetterWording,
  guidance: [
    "ข้อความแบ่ง ๓ ภาค: ภาคเหตุ (cause) → ภาคความประสงค์ (intent) → ภาคสรุป (conclusion)",
    "เรื่อง ต้องสั้น บอกใจความ เช่น 'ขอเชิญเป็นวิทยากร'",
    "ภาคสรุปเลือกตามความประสงค์: จึงเรียนมาเพื่อโปรดพิจารณา / โปรดทราบ / โปรดพิจารณาอนุเคราะห์",
    "references/attachments ใส่เฉพาะที่ผู้ใช้ให้มา",
  ].join("\n"),

  assemble(w, facts, ctx) {
    const recipient = recipientOf(facts);
    const { salutation, closing } = salutationFor(recipient);
    const p = ctx.profile;
    return {
      ...w,
      recipient,
      docNo: docNoOf(facts, ctx),
      agency: p.address.length ? p.address : [p.orgName],
      date: dateOf(facts, ctx),
      salutation,
      closing,
      signer: signerOf(facts, ctx),
      unit: p.unit,
      phone: p.phone || "[ระบุ: โทรศัพท์]",
      email: p.email || null,
    };
  },

  rules: [
    (d) => checkDocNo(d.docNo, REF("๑")),
    (d) => checkDate(d.date, REF("๓"), false),
    (d) => checkBody(d.cause, d.intent, d.conclusion),
    (d) => {
      const out: Finding[] = [];
      if (!pairOk(d.salutation, d.closing)) {
        out.push({ level: "error", rule: "SALUTATION_PAIR", message: `คำขึ้นต้น '${d.salutation}' ไม่คู่กับคำลงท้าย '${d.closing}'`, where: "closing", ref: "ภาคผนวก ๒" });
      }
      if (!salutationFor(d.recipient).confident) {
        out.push({ level: "warning", rule: "SALUTATION_CHECK", message: "ผู้รับเป็นพระบรมวงศานุวงศ์ — ตรวจคำขึ้นต้น/ลงท้าย/สรรพนามตามภาคผนวก ๒ ด้วยตนเอง", where: "recipient", ref: "ภาคผนวก ๒" });
      }
      if (d.references.length > 1) {
        out.push({ level: "info", rule: "REF_LATEST", message: "อ้างถึงให้อ้างหนังสือที่ติดต่อกันครั้งหลังสุดฉบับเดียว เว้นแต่มีสาระต้องพิจารณาต่อเนื่อง", where: "references", ref: REF("๖") });
      }
      if (d.subject.length > 100) out.push({ level: "warning", rule: "SUBJECT_LONG", message: "เรื่องควรสั้นที่สุด", where: "subject", ref: REF("๔") });
      return out;
    },
  ],

  layout(d, ctx) {
    const [agency0 = "", ...agencyRest] = d.agency;
    const blocks: Block[] = [
      { kind: "emblem", heightCm: SPEC.emblemLargeCm, placement: "center" },
      para([{ text: `ที่ ${d.docNo}` }, { text: agency0, tabBefore: true }], { tabs: [{ posCm: SPEC.addressCm }] }),
      ...agencyRest.map((a) => para(a, { indentLeftCm: SPEC.addressCm })),
      para(d.date, { indentLeftCm: SPEC.midCm, spaceBeforePt: SPEC.paraGapPt }),
      labelled("เรื่อง", d.subject),
      labelled(d.salutation, d.recipient, d.salutation.length > 5 ? SPEC.longLabelCm : SPEC.labelCm),
      ...numbered(d.references).map((r, i) => labelled(i === 0 ? "อ้างถึง" : "", r)),
      ...numbered(d.attachments).map((a, i) => labelled(i === 0 ? "สิ่งที่ส่งมาด้วย" : "", a, SPEC.longLabelCm)),
      ...bodyParas([...d.cause, ...d.intent, d.conclusion]),
      para(d.closing, { indentLeftCm: SPEC.midCm, spaceBeforePt: SPEC.closingGapPt, keepWithNext: true }),
      ...signature(d.signer),
      blank(2),
      para(d.unit),
      para(`โทร. ${d.phone}`),
      ...(d.email ? [para(`ไปรษณีย์อิเล็กทรอนิกส์ ${d.email}`)] : []),
      ...(d.copiesTo.length ? [blank(1), para("สำเนาส่ง"), ...d.copiesTo.map((c) => para(c, { indentLeftCm: SPEC.labelCm }))] : []),
    ];
    return docIR(`หนังสือภายนอก — ${d.subject}`, ctx, blocks);
  },
};
