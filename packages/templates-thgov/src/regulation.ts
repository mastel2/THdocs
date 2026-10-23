/**
 * ระเบียบ (ข้อ ๑๗) และข้อบังคับ (ข้อ ๑๘) — ใช้กระดาษตราครุฑ
 * ข้อ ๑ ชื่อ, ข้อ ๒ วันใช้บังคับ และข้อสุดท้าย ผู้รักษาการ ระบบประกอบเองจากข้อมูล
 * AI เขียนเฉพาะคำปรารภและข้อที่เป็นเนื้อหา — โครงตามระเบียบจึงถูกเสมอ
 */
import { para, placeholder, type Block, type DocTypeDef, type Facts, type Context, type Finding } from "@thdocs/core";
import { z } from "zod";
import { COMMON_FACTS, ISSUER_FACT, PACK, checkDate, dateOf, issuerOf, signerOf, yearBE, type Signer } from "./common";
import { SPEC, centered, dateLine, docIR, separator, signature } from "./layout";

export const RegulationWording = z.object({
  title: z.string().describe("ชื่อเรื่องต่อจากคำว่า 'ว่าด้วย' (ไม่ต้องพิมพ์คำว่า 'ว่าด้วย') เช่น 'การใช้ยานพาหนะ'"),
  preamble: z.string().describe("คำปรารภ: เหตุผลโดยย่อ + อำนาจที่ออก (ถ้ามี) ลงท้ายว่า 'จึงวาง...ไว้ ดังต่อไปนี้'"),
  articles: z
    .array(z.object({ chapter: z.string().nullable().describe("ชื่อหมวด ถ้าข้อนี้เริ่มหมวดใหม่ เช่น 'หมวด 1 บททั่วไป' มิฉะนั้น null"), text: z.string().describe("ข้อความของข้อ ไม่ต้องพิมพ์ 'ข้อ n'") }))
    .describe("เฉพาะข้อที่เป็นเนื้อหา — ไม่ต้องเขียนข้อชื่อ ข้อวันใช้บังคับ และข้อผู้รักษาการ ระบบเติมให้"),
});
export type RegulationWording = z.infer<typeof RegulationWording>;

export interface Regulation extends RegulationWording {
  word: string;
  issuer: string;
  edition: string | null;
  year: string;
  fullTitle: string;
  /** ข้อทั้งหมดตามลำดับ รวมข้อที่ระบบประกอบ */
  allArticles: { chapter: string | null; text: string }[];
  date: string;
  signer: Signer;
}

function make(id: "regulation" | "bylaw"): DocTypeDef<RegulationWording, Regulation> {
  const word = id === "regulation" ? "ระเบียบ" : "ข้อบังคับ";
  const ref = id === "regulation" ? "ระเบียบงานสารบรรณ ข้อ ๑๗" : "ระเบียบงานสารบรรณ ข้อ ๑๘";

  const assemble = (w: RegulationWording, facts: Facts, ctx: Context): Regulation => {
    const issuer = issuerOf(facts, ctx);
    const year = yearBE(ctx);
    const edition = facts.edition?.trim() || null;
    const fullTitle = `${word}${issuer} ว่าด้วย${w.title.replace(/^ว่าด้วย\s*/, "")}${edition ? ` (ฉบับที่ ${edition})` : ""} พ.ศ. ${year}`;
    const signer = signerOf(facts, ctx);
    const keeper = facts.keeper?.trim() || signer.position[0] || placeholder("ผู้รักษาการ");
    const effective = facts.effective?.trim() || "ตั้งแต่วันถัดจากวันประกาศเป็นต้นไป";
    const body = w.articles.map((a) => ({ chapter: a.chapter?.trim() || null, text: a.text.replace(/^\s*ข้อ\s*[0-9๐-๙]+\s*/, "").trim() }));
    return {
      ...w,
      word,
      issuer,
      edition,
      year,
      fullTitle,
      allArticles: [
        { chapter: null, text: `${word}นี้เรียกว่า "${fullTitle}"` },
        { chapter: null, text: `${word}นี้ให้ใช้บังคับ${effective}` },
        ...body,
        { chapter: null, text: `ให้${keeper}รักษาการตาม${word}นี้` },
      ],
      date: dateOf(facts, ctx, true),
      signer,
    };
  };

  return {
    id,
    pack: PACK,
    name: word,
    description:
      id === "regulation"
        ? "บรรดาข้อความที่วางไว้เป็นหลักปฏิบัติงานเป็นการประจำ โดยอาศัยอำนาจของกฎหมายหรือไม่ก็ได้"
        : "บรรดาข้อความที่ผู้มีอำนาจตราขึ้น โดยอาศัยอำนาจของกฎหมายที่บัญญัติให้กระทำได้",
    facts: [
      { key: "purpose", question: `${word}ว่าด้วยเรื่องอะไร`, required: true, example: "การใช้ยานพาหนะส่วนกลาง" },
      { key: "details", question: "หลักเกณฑ์สำคัญที่ต้องการกำหนด", required: false },
      {
        key: "authority",
        question: id === "bylaw" ? "กฎหมายที่ให้อำนาจออกข้อบังคับ (มาตรา/ข้อ)" : "กฎหมาย/ระเบียบที่ให้อำนาจ (ถ้ามี)",
        required: id === "bylaw",
      },
      { key: "effective", question: "วันใช้บังคับ (ไม่ระบุ = ตั้งแต่วันถัดจากวันประกาศเป็นต้นไป)", required: false },
      { key: "keeper", question: "ผู้รักษาการ (ไม่ระบุ = ตำแหน่งผู้ลงนาม)", required: false },
      { key: "edition", question: "ฉบับที่ (ฉบับแรกไม่ต้องระบุ)", required: false },
      ISSUER_FACT,
      ...COMMON_FACTS.filter((f) => f.key !== "docNo"),
    ],
    wordingSchema: RegulationWording,
    guidance: [
      `คำปรารภ: เหตุผลโดยย่อที่ออก${word} แล้วอ้างอำนาจ${id === "bylaw" ? " (ต้องมี เพราะข้อบังคับต้องอาศัยอำนาจกฎหมาย)" : " ถ้าผู้ใช้ให้มา"} — ห้ามแต่งเลขมาตรา/ข้อของกฎหมายที่ผู้ใช้ไม่ได้ให้ ใช้ [ระบุ: กฎหมายที่ให้อำนาจ] แทน`,
      `ลงท้ายคำปรารภว่า 'จึงวาง${word}ไว้ ดังต่อไปนี้' (ข้อบังคับใช้ 'จึงออกข้อบังคับไว้ ดังต่อไปนี้')`,
      "articles มีเฉพาะข้อที่เป็นเนื้อหา เรียงตามลำดับ แต่ละข้อหนึ่งเรื่อง; ถ้ายาวหลายเรื่องแบ่งหมวดด้วย chapter",
    ].join("\n"),
    example:
      id === "regulation"
        ? {
            request: "ออกระเบียบว่าด้วยการใช้รถยนต์ส่วนกลาง ต้องขอใช้ล่วงหน้า 1 วันผ่านระบบ ผู้ขับต้องบันทึกเลขไมล์ทุกครั้ง ห้ามนำไปใช้ส่วนตัว",
            facts: {},
            wording: {
              title: "การใช้รถยนต์ส่วนกลาง",
              preamble: "โดยที่เป็นการสมควรกำหนดหลักเกณฑ์การใช้รถยนต์ส่วนกลางของสำนักงานตัวอย่าง ให้เป็นไปอย่างมีประสิทธิภาพและประหยัด จึงวางระเบียบไว้ ดังต่อไปนี้",
              articles: [
                { chapter: null, text: "การขอใช้รถยนต์ส่วนกลาง ให้ยื่นคำขอผ่านระบบจองยานพาหนะล่วงหน้าไม่น้อยกว่าหนึ่งวันทำการ" },
                { chapter: null, text: "ผู้ขับรถยนต์ส่วนกลางต้องบันทึกเลขไมล์ก่อนและหลังการใช้งานทุกครั้ง" },
                { chapter: null, text: "ห้ามนำรถยนต์ส่วนกลางไปใช้ในกิจการส่วนตัว" },
              ],
            },
          }
        : {
            request: "ออกข้อบังคับว่าด้วยการประชุมคณะกรรมการบริหาร ต้องมีกรรมการมาประชุมไม่น้อยกว่ากึ่งหนึ่งจึงเป็นองค์ประชุม อาศัยอำนาจตามมาตรา 20 แห่งพระราชบัญญัติจัดตั้งสำนักงานตัวอย่าง",
            facts: { authority: "มาตรา 20 แห่งพระราชบัญญัติจัดตั้งสำนักงานตัวอย่าง พ.ศ. 2560" },
            wording: {
              title: "การประชุมคณะกรรมการบริหาร",
              preamble: "อาศัยอำนาจตามความในมาตรา 20 แห่งพระราชบัญญัติจัดตั้งสำนักงานตัวอย่าง พ.ศ. 2560 คณะกรรมการบริหารจึงออกข้อบังคับไว้ ดังต่อไปนี้",
              articles: [
                { chapter: null, text: "การประชุมคณะกรรมการบริหารต้องมีกรรมการมาประชุมไม่น้อยกว่ากึ่งหนึ่งของจำนวนกรรมการทั้งหมด จึงเป็นองค์ประชุม" },
                { chapter: null, text: "การวินิจฉัยชี้ขาดของที่ประชุมให้ถือเสียงข้างมาก ถ้าคะแนนเสียงเท่ากันให้ประธานออกเสียงเพิ่มขึ้นอีกเสียงหนึ่งเป็นเสียงชี้ขาด" },
              ],
            },
          },

    assemble,

    rules: [
      (d) => checkDate(d.date, ref, true),
      (d): Finding[] => {
        const out: Finding[] = [];
        if (!d.articles.length) out.push({ level: "error", rule: "REG_BODY", message: `${word}ต้องมีข้อที่เป็นเนื้อหาอย่างน้อยหนึ่งข้อ`, where: "wording.articles", ref });
        if (d.articles.some((a) => /รักษาการ|เรียกว่า/.test(a.text))) {
          out.push({ level: "warning", rule: "REG_DUP", message: "ข้อชื่อและข้อผู้รักษาการระบบเติมให้แล้ว — ลบข้อที่ซ้ำออก", where: "wording.articles", ref });
        }
        if (id === "bylaw" && !/อาศัยอำนาจ/.test(d.preamble)) {
          out.push({ level: "error", rule: "BYLAW_AUTHORITY", message: "ข้อบังคับต้องอ้างกฎหมายที่ให้อำนาจในคำปรารภ ('อาศัยอำนาจตาม...')", where: "wording.preamble", ref });
        }
        if (d.edition && /^\s*[1๑]\s*$/.test(d.edition)) {
          out.push({ level: "info", rule: "REG_EDITION", message: "ฉบับแรกไม่ต้องระบุฉบับที่", where: "facts.edition", ref });
        }
        return out;
      },
    ],

    layout(d, ctx) {
      const blocks: Block[] = [
        { kind: "emblem", heightCm: SPEC.emblemLargeCm, placement: "center" },
        centered(`${d.word}${d.issuer}`, { bold: true }),
        centered(`ว่าด้วย${d.title.replace(/^ว่าด้วย\s*/, "")}`, { bold: true }),
        ...(d.edition ? [centered(`(ฉบับที่ ${d.edition})`, { bold: true })] : []),
        centered(`พ.ศ. ${d.year}`, { bold: true }),
        separator(),
        para(d.preamble, { firstLineCm: SPEC.firstLineCm, align: "thaiDistribute" }),
        ...d.allArticles.flatMap((a, i): Block[] => [
          ...(a.chapter ? [centered(a.chapter, { bold: true, spaceBeforePt: SPEC.closingGapPt })] : []),
          para(`ข้อ ${i + 1}  ${a.text}`, { firstLineCm: SPEC.firstLineCm, align: "thaiDistribute", spaceBeforePt: SPEC.paraGapPt }),
        ]),
        dateLine("ประกาศ ณ วันที่", d.date),
        ...signature(d.signer),
      ];
      return docIR(d.fullTitle, ctx, blocks);
    },
  };
}

export const regulation = make("regulation");
export const bylaw = make("bylaw");
