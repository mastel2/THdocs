/**
 * หนังสือภายใน (บันทึกข้อความ) — ระเบียบงานสารบรรณ ข้อ ๑๒
 *   memo           แบบทั่วไป: เหตุ → ความประสงค์ → สรุป
 *   memo_proposal  บันทึกเสนอเรื่องเพื่อพิจารณา: แบ่งหัวข้อ เรื่องเดิม / ข้อเท็จจริง / ข้อกฎหมาย / ข้อพิจารณา / ข้อเสนอ
 * แยกเป็นสองชนิดเพื่อให้ schema ไม่กำกวม (โมเดลเล็กมักเติมทั้งสองแบบพร้อมกัน)
 */
import { para, type Block, type Context, type DocTypeDef, type FactSpec, type Facts, type Finding } from "@thdocs/core";
import { z } from "zod";
import { COMMON_FACTS, PACK, checkBody, checkDate, checkDocNo, dateOf, docNoOf, recipientOf, signerOf, type Signer } from "./common";
import { SPEC, bodyParas, docIR, signature } from "./layout";
import { salutationFor } from "./salutation";

const head = {
  subject: z.string().describe("เรื่อง: ใจความย่อที่สั้นที่สุด"),
};

export const MemoWording = z.object({
  ...head,
  cause: z.array(z.string()).describe("ภาคเหตุ แต่ละข้อคือหนึ่งย่อหน้า"),
  intent: z.array(z.string()).describe("ภาคความประสงค์ แต่ละข้อคือหนึ่งย่อหน้า"),
  conclusion: z.string().describe("ภาคสรุป เช่น 'จึงเรียนมาเพื่อโปรดพิจารณาอนุมัติ'"),
});
export type MemoWording = z.infer<typeof MemoWording>;

export const MemoProposalWording = z.object({
  ...head,
  sections: z
    .array(z.object({ heading: z.string().describe("ชื่อหัวข้อ ไม่ต้องใส่เลขลำดับ"), paragraphs: z.array(z.string()).describe("ย่อหน้าในหัวข้อนี้") }))
    .describe("หัวข้อตามลำดับ: เรื่องเดิม, ข้อเท็จจริง, ข้อกฎหมาย/ระเบียบ (ถ้ามี), ข้อพิจารณา, ข้อเสนอ"),
  conclusion: z.string().describe("ภาคสรุป เช่น 'จึงเรียนมาเพื่อโปรดพิจารณา หากเห็นชอบโปรดอนุมัติตามข้อ ...'"),
});
export type MemoProposalWording = z.infer<typeof MemoProposalWording>;

interface MemoHeader {
  subject: string;
  recipient: string;
  unitLine: string;
  docNo: string;
  date: string;
  salutation: string;
  signer: Signer;
  conclusion: string;
}
export type Memo = MemoWording & MemoHeader;
export type MemoProposal = MemoProposalWording & MemoHeader;

const REF = (n: string) => `ระเบียบงานสารบรรณ ข้อ ๑๒.${n}`;

const FACTS: FactSpec[] = [
  { key: "recipient", question: "เรียนใคร (ตำแหน่ง)", required: true, example: "ผู้อำนวยการกองคลัง" },
  { key: "purpose", question: "ต้องการอะไร (ขออนุมัติ / รายงาน / แจ้งเพื่อทราบ)", required: true },
  { key: "details", question: "รายละเอียดสำคัญ (วัน เวลา สถานที่ จำนวน งบประมาณ)", required: false },
  ...COMMON_FACTS,
];

function header<W extends { subject: string; conclusion: string }>(w: W, facts: Facts, ctx: Context): W & MemoHeader {
  const recipient = recipientOf(facts);
  const p = ctx.profile;
  return {
    ...w,
    recipient,
    unitLine: [p.unit, p.phone ? `โทร. ${p.phone}` : ""].filter(Boolean).join(" "),
    docNo: docNoOf(facts, ctx),
    date: dateOf(facts, ctx),
    salutation: salutationFor(recipient).salutation,
    signer: signerOf(facts, ctx),
  };
}

const headerRules = [
  (d: MemoHeader) => checkDocNo(d.docNo, REF("๒")),
  (d: MemoHeader) => checkDate(d.date, REF("๓"), false),
  (d: MemoHeader): Finding[] =>
    /โทร/.test(d.unitLine)
      ? []
      : [{ level: "info", rule: "MEMO_PHONE", message: "ส่วนราชการ ให้ลงชื่อส่วนงานเจ้าของเรื่องพร้อมหมายเลขโทรศัพท์ (ถ้ามี)", where: "unitLine", ref: REF("๑") }],
];

function layout(d: MemoHeader, body: Block[], ctx: Context) {
  const label = (text: string) => ({ text, bold: true, sizePt: SPEC.memo.labelPt });
  const blocks: Block[] = [
    { kind: "emblem", heightCm: SPEC.emblemSmallCm, placement: "left-float" },
    para([{ text: "บันทึกข้อความ", bold: true, sizePt: SPEC.memo.titlePt }], { align: "center" }),
    para([label(ctx.profile.unitLabel ?? "ส่วนราชการ"), { text: `  ${d.unitLine}` }], { spaceBeforePt: SPEC.paraGapPt }),
    para([label("ที่"), { text: `  ${d.docNo}` }, { ...label("วันที่"), tabBefore: true }, { text: `  ${d.date}` }], {
      tabs: [{ posCm: SPEC.memo.dateTabCm }],
    }),
    para([label("เรื่อง"), { text: `  ${d.subject}` }], { indentLeftCm: SPEC.labelCm, hangingCm: SPEC.labelCm }),
    para(`${d.salutation}  ${d.recipient}`, { spaceBeforePt: SPEC.paraGapPt }),
    ...body,
    ...bodyParas([d.conclusion]),
    ...signature(d.signer),
  ];
  return docIR(`บันทึกข้อความ — ${d.subject}`, ctx, blocks);
}

export const memo: DocTypeDef<MemoWording, Memo> = {
  id: "memo",
  pack: PACK,
  name: "บันทึกข้อความ",
  description: "หนังสือภายใน แบบทั่วไป (เหตุ–ความประสงค์–สรุป)",
  facts: FACTS,
  wordingSchema: MemoWording,
  example: {
    request: "ขออนุมัติผู้อำนวยการสำนักงานตัวอย่าง จัดอบรมการใช้ระบบสารบรรณอิเล็กทรอนิกส์ให้บุคลากร 50 คน วันที่ 10 พ.ย. 2569 ที่ห้องประชุมใหญ่ งบประมาณ 15,000 บาท เรื่องด่วน",
    facts: { recipient: "ผู้อำนวยการสำนักงานตัวอย่าง" },
    options: { speed: "ด่วน" },
    wording: {
      subject: "ขออนุมัติจัดอบรมการใช้งานระบบสารบรรณอิเล็กทรอนิกส์",
      cause: ["ด้วยกองบริหารทั่วไปได้นำระบบสารบรรณอิเล็กทรอนิกส์มาใช้ตั้งแต่เดือนตุลาคม 2569 แต่บุคลากรบางส่วนยังใช้งานไม่คล่อง"],
      intent: ["กองบริหารทั่วไปจึงขออนุมัติจัดอบรมการใช้งานระบบดังกล่าว ให้แก่บุคลากร จำนวน 50 คน ในวันที่ 10 พฤศจิกายน 2569 ณ ห้องประชุมใหญ่ โดยใช้งบประมาณ 15,000 บาท"],
      conclusion: "จึงเรียนมาเพื่อโปรดพิจารณาอนุมัติ",
    },
  },
  guidance: "เขียน cause → intent → conclusion\nภาคสรุปของบันทึกถึงผู้บังคับบัญชา เช่น 'จึงเรียนมาเพื่อโปรดพิจารณา' หรือ 'จึงเรียนมาเพื่อโปรดทราบ'",
  assemble: header,
  rules: [...headerRules, (d) => checkBody(d.cause, d.intent, d.conclusion)],
  layout: (d, ctx) => layout(d, bodyParas([...d.cause, ...d.intent]), ctx),
};

export const memoProposal: DocTypeDef<MemoProposalWording, MemoProposal> = {
  id: "memo_proposal",
  pack: PACK,
  name: "บันทึกเสนอเรื่อง",
  description: "หนังสือภายใน เสนอเรื่องให้ผู้บังคับบัญชาพิจารณา แบ่งหัวข้อ เรื่องเดิม/ข้อเท็จจริง/ข้อพิจารณา/ข้อเสนอ",
  facts: FACTS,
  wordingSchema: MemoProposalWording,
  example: {
    request: "เสนอผู้อำนวยการขอความเห็นชอบซื้อคอมพิวเตอร์ทดแทน 8 เครื่อง วงเงิน 200,000 บาท งบปี 2570 เพราะเครื่องเดิมที่ซื้อปี 2562 ชำรุดไม่คุ้มซ่อม (มีรายงานผลตรวจสอบแนบ)",
    facts: { recipient: "ผู้อำนวยการสำนักงานตัวอย่าง" },
    wording: {
      subject: "ขอความเห็นชอบจัดซื้อเครื่องคอมพิวเตอร์ทดแทน",
      sections: [
        { heading: "เรื่องเดิม", paragraphs: ["กองบริหารทั่วไปมีเครื่องคอมพิวเตอร์ใช้งาน จำนวน 20 เครื่อง จัดซื้อเมื่อปี 2562"] },
        { heading: "ข้อเท็จจริง", paragraphs: ["เครื่องคอมพิวเตอร์ จำนวน 8 เครื่อง ชำรุดและไม่คุ้มค่าซ่อม ตามรายงานผลการตรวจสอบที่แนบ"] },
        { heading: "ข้อพิจารณา", paragraphs: ["เพื่อให้การปฏิบัติงานเป็นไปอย่างต่อเนื่อง เห็นควรจัดซื้อเครื่องคอมพิวเตอร์ทดแทน จำนวน 8 เครื่อง วงเงิน 200,000 บาท จากงบประมาณประจำปี 2570"] },
        { heading: "ข้อเสนอ", paragraphs: ["เห็นควรอนุมัติให้กองบริหารทั่วไปดำเนินการจัดซื้อตามข้อ 3"] },
      ],
      conclusion: "จึงเรียนมาเพื่อโปรดพิจารณา หากเห็นชอบโปรดอนุมัติตามข้อ 4",
    },
  },
  guidance: [
    "แบ่งเนื้อหาเป็นหัวข้อตามลำดับ: เรื่องเดิม → ข้อเท็จจริง → ข้อกฎหมาย/ระเบียบ (ถ้ามีที่อ้างได้จริง) → ข้อพิจารณา → ข้อเสนอ",
    "ข้อเสนอต้องระบุให้ชัดว่าขอให้ผู้บังคับบัญชาสั่งการอะไร",
    "ห้ามอ้างข้อกฎหมายหรือเลขระเบียบที่ผู้ใช้ไม่ได้ให้มา ให้ใช้ [ระบุ: ระเบียบที่เกี่ยวข้อง] แทน",
  ].join("\n"),
  assemble: header,
  rules: [
    ...headerRules,
    (d): Finding[] => {
      if (!d.sections.length) return [{ level: "error", rule: "MEMO_SECTIONS", message: "บันทึกเสนอเรื่องต้องมีหัวข้อ", where: "wording.sections" }];
      return d.sections.some((s) => s.heading.includes("ข้อเสนอ"))
        ? []
        : [{ level: "warning", rule: "MEMO_PROPOSAL", message: "ควรมีหัวข้อ 'ข้อเสนอ' เพื่อให้ผู้บังคับบัญชาสั่งการได้", where: "wording.sections" }];
    },
  ],
  layout: (d, ctx) =>
    layout(
      d,
      d.sections.flatMap((s, i) => [
        para([{ text: `${i + 1}. ${s.heading.replace(/^\s*[0-9๐-๙]+\.\s*/, "")}`, bold: true }], { firstLineCm: SPEC.firstLineCm, spaceBeforePt: SPEC.paraGapPt }),
        ...bodyParas(s.paragraphs),
      ]),
      ctx,
    ),
};
