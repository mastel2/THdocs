/**
 * หนังสือที่ออกเผยแพร่ — ใช้กระดาษตราครุฑ
 *   ประกาศ / แจ้งความ (ข้อ ๒๐): มีผู้ลงนาม
 *   แถลงการณ์ (ข้อ ๒๑) และข่าว (ข้อ ๒๒): ไม่มีลายมือชื่อ ลงชื่อส่วนราชการและวันที่ท้ายข้อความ
 */
import { para, type Block, type DocTypeDef, type Finding } from "@thdocs/core";
import { z } from "zod";
import { COMMON_FACTS, ISSUER_FACT, PACK, checkDate, dateOf, issuerOf, signerOf, type Signer } from "./common";
import { SPEC, bodyParas, centered, dateLine, docIR, separator, signature } from "./layout";

export const AnnouncementWording = z.object({
  subject: z.string().describe("เรื่อง: ใจความย่อ"),
  paragraphs: z.array(z.string()).describe("ข้อความ: เหตุผลที่ประกาศ → สิ่งที่ประกาศ/รายละเอียด แต่ละข้อคือหนึ่งย่อหน้า"),
});
export type AnnouncementWording = z.infer<typeof AnnouncementWording>;

export interface Announcement extends AnnouncementWording {
  word: "ประกาศ" | "แจ้งความ";
  issuer: string;
  date: string;
  signer: Signer;
}

export const announcement: DocTypeDef<AnnouncementWording, Announcement> = {
  id: "announcement",
  pack: PACK,
  name: "ประกาศ",
  description: "ข้อความที่ส่วนราชการประกาศให้ทราบหรือแนะแนวทางปฏิบัติ (ใช้คำว่า 'แจ้งความ' เมื่อกฎหมายกำหนด)",
  facts: [
    { key: "purpose", question: "ประกาศเรื่องอะไร", required: true, example: "รับสมัครพนักงานราชการ" },
    { key: "details", question: "รายละเอียดที่ต้องประกาศ (วันที่ คุณสมบัติ วิธีการ ฯลฯ)", required: false },
    { key: "word", question: "ใช้คำว่า 'แจ้งความ' แทน 'ประกาศ' ไหม (เฉพาะเมื่อกฎหมายกำหนด — ตอบ 'แจ้งความ' หรือเว้นว่าง)", required: false },
    ISSUER_FACT,
    ...COMMON_FACTS.filter((f) => f.key !== "docNo"),
  ],
  wordingSchema: AnnouncementWording,
  guidance: "เขียนเหตุผลที่ประกาศก่อน แล้วตามด้วยสิ่งที่ประกาศ ใช้ภาษาที่ประชาชนทั่วไปเข้าใจได้\nย่อหน้าสุดท้ายมักเป็น 'จึงประกาศให้ทราบโดยทั่วกัน'",
  example: {
    request: "ประกาศหยุดให้บริการระบบสารสนเทศชั่วคราวเพื่อบำรุงรักษา วันที่ 1 พ.ย. 2569 เวลา 08.00–12.00 น.",
    facts: {},
    wording: {
      subject: "หยุดให้บริการระบบสารสนเทศชั่วคราว",
      paragraphs: [
        "ด้วยสำนักงานตัวอย่างจะดำเนินการบำรุงรักษาระบบสารสนเทศ เพื่อเพิ่มประสิทธิภาพและความมั่นคงปลอดภัยของระบบ",
        "จึงขอประกาศหยุดให้บริการระบบสารสนเทศของสำนักงานตัวอย่างชั่วคราว ในวันที่ 1 พฤศจิกายน 2569 เวลา 08.00 – 12.00 น.",
        "จึงประกาศให้ทราบโดยทั่วกัน",
      ],
    },
  },

  assemble(w, facts, ctx) {
    return {
      ...w,
      word: facts.word?.includes("แจ้งความ") ? "แจ้งความ" : "ประกาศ",
      issuer: issuerOf(facts, ctx),
      date: dateOf(facts, ctx, true),
      signer: signerOf(facts, ctx),
    };
  },

  rules: [
    (d) => checkDate(d.date, "ระเบียบงานสารบรรณ ข้อ ๒๐.๔", true),
    (d): Finding[] => (d.paragraphs.length ? [] : [{ level: "error", rule: "ANN_BODY", message: "ต้องมีข้อความ (เหตุผล + สิ่งที่ประกาศ)", where: "wording.paragraphs", ref: "ระเบียบงานสารบรรณ ข้อ ๒๐.๓" }]),
  ],

  layout(d, ctx) {
    const blocks: Block[] = [
      { kind: "emblem", heightCm: SPEC.emblemLargeCm, placement: "center" },
      centered(`${d.word}${d.issuer}`, { bold: true }),
      centered(`เรื่อง ${d.subject}`),
      separator(),
      ...bodyParas(d.paragraphs),
      dateLine(d.word === "แจ้งความ" ? "แจ้งความ ณ วันที่" : "ประกาศ ณ วันที่", d.date),
      ...signature(d.signer),
    ];
    return docIR(`${d.word} — ${d.subject}`, ctx, blocks);
  },
};

// ------------------------------------------------------------ แถลงการณ์ / ข่าว
export const StatementWording = z.object({
  subject: z.string().describe("เรื่อง: ใจความย่อ"),
  paragraphs: z.array(z.string()).describe("ข้อความ: ข้อเท็จจริงที่ต้องการแถลง/เผยแพร่ แต่ละข้อคือหนึ่งย่อหน้า"),
});
export type StatementWording = z.infer<typeof StatementWording>;

export interface Statement extends StatementWording {
  word: string;
  issuer: string;
  number: string | null;
  date: string;
}

function makeStatement(id: "statement" | "news"): DocTypeDef<StatementWording, Statement> {
  const word = id === "statement" ? "แถลงการณ์" : "ข่าว";
  const ref = id === "statement" ? "ระเบียบงานสารบรรณ ข้อ ๒๑" : "ระเบียบงานสารบรรณ ข้อ ๒๒";
  return {
    id,
    pack: PACK,
    name: word,
    description:
      id === "statement"
        ? "ข้อความที่ส่วนราชการแถลงเพื่อทำความเข้าใจในกิจการของทางราชการหรือเหตุการณ์ที่ควรทราบชัดแจ้ง"
        : "ข้อความที่ส่วนราชการเห็นสมควรเผยแพร่ให้ทราบ",
    facts: [
      { key: "purpose", question: `${word}เรื่องอะไร`, required: true },
      { key: "details", question: "ข้อเท็จจริงที่ต้องการเผยแพร่", required: false },
      { key: "number", question: "ฉบับที่ (เมื่อออกหลายฉบับในเรื่องเดียวกัน)", required: false },
      ISSUER_FACT,
      COMMON_FACTS.find((f) => f.key === "date")!,
    ],
    wordingSchema: StatementWording,
    guidance: `${word}ไม่มีลายมือชื่อ — เขียนเฉพาะข้อความ ใช้ข้อเท็จจริงที่ได้รับเท่านั้น กระชับ และเข้าใจง่ายสำหรับประชาชน`,
    example:
      id === "statement"
        ? {
            request: "แถลงข้อเท็จจริงกรณีมีข่าวว่าข้อมูลผู้รับบริการรั่วไหล ตรวจสอบแล้วไม่พบการรั่วไหล ระบบทำงานปกติ",
            facts: {},
            wording: {
              subject: "ข้อเท็จจริงกรณีข่าวข้อมูลผู้รับบริการรั่วไหล",
              paragraphs: [
                "ตามที่มีการเผยแพร่ข่าวทางสื่อสังคมออนไลน์ว่าข้อมูลผู้รับบริการของสำนักงานตัวอย่างรั่วไหลนั้น",
                "สำนักงานตัวอย่างได้ตรวจสอบระบบสารสนเทศทั้งหมดแล้ว ไม่พบการเข้าถึงหรือการรั่วไหลของข้อมูลผู้รับบริการแต่อย่างใด และระบบยังคงให้บริการได้ตามปกติ",
              ],
            },
          }
        : {
            request: "ข่าวสำนักงานจัดอบรมการเขียนหนังสือราชการให้บุคลากร 50 คน เมื่อ 10 พ.ย. 2569",
            facts: {},
            wording: {
              subject: "จัดอบรมหลักสูตรการเขียนหนังสือราชการ",
              paragraphs: [
                "เมื่อวันที่ 10 พฤศจิกายน 2569 สำนักงานตัวอย่างจัดอบรมหลักสูตรการเขียนหนังสือราชการ ให้แก่บุคลากร จำนวน 50 คน ณ ห้องประชุมใหญ่ สำนักงานตัวอย่าง เพื่อพัฒนาทักษะการจัดทำหนังสือราชการให้ถูกต้องตามระเบียบ",
              ],
            },
          },

    assemble(w, facts, ctx) {
      return { ...w, word, issuer: issuerOf(facts, ctx), number: facts.number?.trim() || null, date: dateOf(facts, ctx) };
    },

    rules: [(d) => checkDate(d.date, ref, false)],

    layout(d, ctx) {
      const blocks: Block[] = [
        { kind: "emblem", heightCm: SPEC.emblemLargeCm, placement: "center" },
        centered(`${d.word}${d.issuer}`, { bold: true }),
        centered(`เรื่อง ${d.subject}`),
        ...(d.number ? [centered(`ฉบับที่ ${d.number}`)] : []),
        separator(),
        ...bodyParas(d.paragraphs),
        para(d.issuer, { indentLeftCm: SPEC.midCm, spaceBeforePt: SPEC.closingGapPt, keepWithNext: true }),
        para(d.date, { indentLeftCm: SPEC.midCm }),
      ];
      return docIR(`${d.word} — ${d.subject}`, ctx, blocks);
    },
  };
}

export const statement = makeStatement("statement");
export const news = makeStatement("news");
