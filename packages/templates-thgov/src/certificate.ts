/** หนังสือรับรอง — ระเบียบงานสารบรรณ ข้อ ๒๔ (ใช้กระดาษตราครุฑ) */
import { para, placeholder, thaiDate, type Block, type DocTypeDef, type Finding } from "@thdocs/core";
import { z } from "zod";
import { COMMON_FACTS, PACK, checkDate, dateOf, signerOf, type Signer } from "./common";
import { SPEC, bodyParas, docIR, signature } from "./layout";

const OPENING = "หนังสือฉบับนี้ให้ไว้เพื่อรับรองว่า";

export const CertificateWording = z.object({
  body: z
    .array(z.string())
    .describe(`ข้อความรับรอง ย่อหน้าแรกขึ้นต้นด้วย '${OPENING}' ตามด้วยชื่อเต็ม ตำแหน่ง สังกัด และสิ่งที่รับรอง`),
});
export type CertificateWording = z.infer<typeof CertificateWording>;

export interface Certificate extends CertificateWording {
  docNo: string;
  agency: string[];
  date: string;
  signer: Signer;
}

const REF = "ระเบียบงานสารบรรณ ข้อ ๒๔";

export const certificate: DocTypeDef<CertificateWording, Certificate> = {
  id: "certificate",
  pack: PACK,
  name: "หนังสือรับรอง",
  description: "หนังสือที่ส่วนราชการออกให้เพื่อรับรองบุคคล นิติบุคคล หรือหน่วยงาน",
  facts: [
    { key: "personName", question: "ชื่อเต็มของผู้ได้รับการรับรอง", required: true },
    { key: "personDetail", question: "ตำแหน่ง สังกัด หรือข้อมูลระบุตัวผู้ได้รับการรับรอง", required: true },
    { key: "certifyWhat", question: "รับรองเรื่องอะไร", required: true, example: "เป็นพนักงานประจำ ปฏิบัติงานตั้งแต่ปี ๒๕๖๕" },
    { key: "usage", question: "นำไปใช้เพื่ออะไร (ถ้ามี)", required: false, example: "ประกอบการขอสินเชื่อ" },
    ...COMMON_FACTS,
  ],
  wordingSchema: CertificateWording,
  guidance: [
    `ย่อหน้าแรกต้องขึ้นต้นด้วย '${OPENING}'`,
    "ระบุชื่อเต็ม ตำแหน่ง สังกัด ตามข้อเท็จจริงที่ได้รับเท่านั้น แล้วตามด้วยสิ่งที่รับรอง",
    "ถ้ามีวัตถุประสงค์การนำไปใช้ ให้ปิดท้ายด้วยย่อหน้า 'ให้ไว้เพื่อ...' หรือรวมในย่อหน้าเดียว",
  ].join("\n"),

  assemble(w, facts, ctx) {
    const yearBE = String((ctx.options.date ?? new Date()).getFullYear() + 543);
    const p = ctx.profile;
    return {
      ...w,
      docNo: facts.docNo?.trim() || `${placeholder("เลขที่")}/${yearBE}`,
      agency: p.address.length ? p.address : [p.orgName],
      date: dateOf(facts, ctx, true),
      signer: signerOf(facts, ctx),
    };
  },

  rules: [
    (d) => checkDate(d.date, REF, true),
    (d) => {
      const out: Finding[] = [];
      if (!d.body[0]?.startsWith(OPENING)) {
        out.push({ level: "error", rule: "CERT_OPENING", message: `ข้อความต้องขึ้นต้นว่า '${OPENING}'`, where: "wording.body[0]", ref: `${REF}.๓` });
      }
      return out;
    },
  ],

  layout(d, ctx) {
    const [agency0 = "", ...agencyRest] = d.agency;
    const blocks: Block[] = [
      { kind: "emblem", heightCm: SPEC.emblemLargeCm, placement: "center" },
      para([{ text: `เลขที่ ${d.docNo}` }, { text: agency0, tabBefore: true }], { tabs: [{ posCm: SPEC.addressCm }] }),
      ...agencyRest.map((a) => para(a, { indentLeftCm: SPEC.addressCm })),
      ...bodyParas(d.body).map((b, i) => (i === 0 && b.kind === "para" ? { ...b, spaceBeforePt: SPEC.closingGapPt } : b)),
      para(`ให้ไว้ ณ วันที่ ${d.date}`, { indentLeftCm: SPEC.midCm - 2, spaceBeforePt: SPEC.closingGapPt, keepWithNext: true }),
      ...signature(d.signer),
    ];
    return docIR(`หนังสือรับรอง — ${thaiDate(ctx.options.date ?? new Date())}`, ctx, blocks);
  },
};
