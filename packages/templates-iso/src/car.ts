/**
 * ใบขอให้ปฏิบัติการแก้ไข (Corrective Action Request / CAR)
 * ปัญหา → แก้ไขเฉพาะหน้า → วิเคราะห์สาเหตุ → มาตรการป้องกันการเกิดซ้ำ → ติดตามผล
 * สาเหตุต้องมาจากการสอบสวนจริง — ไม่มีข้อมูลระบบเว้นเป็น [ระบุ] ไม่ให้ AI เดา
 */
import { para, placeholder, thaiDate, type Block, type DocTypeDef, type Finding } from "@thdocs/core";
import { z } from "zod";
import { CONTROL_FACTS, PACK, SPEC, controlOf, controlRules, grid, infoTable, isoIR, paras, section, signTable, type Control } from "./common";

export const CarWording = z.object({
  title: z.string().describe("หัวข้อปัญหาสั้น ๆ เช่น 'ไม่มีการเปรียบเทียบราคาก่อนสั่งซื้อ'"),
  problem: z.array(z.string()).describe("รายละเอียดปัญหา: เกิดอะไร ที่ไหน เมื่อไร พบจากอะไร พร้อมหลักฐาน"),
  requirement: z.string().describe("ข้อกำหนดที่ไม่เป็นไปตาม เช่น 'QP-PU-01 ขั้นตอนที่ 3' — ไม่ทราบให้ใส่ [ระบุ: ข้อกำหนด]"),
  correction: z.array(z.string()).describe("การแก้ไขเฉพาะหน้า (แก้ปัญหาที่เกิดขึ้นแล้ว) — ไม่มีข้อมูลให้ใส่ [ระบุ: การแก้ไขเฉพาะหน้า]"),
  rootCause: z.array(z.string()).describe("สาเหตุที่แท้จริงจากการสอบสวน — ใช้เฉพาะที่ผู้ใช้ให้มา ไม่มีให้ใส่ [ระบุ: สาเหตุที่แท้จริง]"),
  actions: z
    .array(z.object({ action: z.string().describe("มาตรการป้องกันการเกิดซ้ำ"), owner: z.string().describe("ผู้รับผิดชอบ (ตำแหน่ง)"), due: z.string().describe("กำหนดเสร็จ — ไม่ทราบให้ใส่ [ระบุ: วันที่]") }))
    .describe("มาตรการแก้ไขเพื่อป้องกันการเกิดซ้ำ ต้องแก้ที่สาเหตุ"),
  verification: z.string().describe("วิธีติดตามว่ามาตรการได้ผล เช่น สุ่มตรวจ 10 รายการภายใน 3 เดือน"),
});
export type CarWording = z.infer<typeof CarWording>;
export type Car = CarWording & { control: Control; info: [string, string][]; issuer: string; responder: string };

const SOURCES = "ตรวจติดตามภายใน / ข้อร้องเรียนลูกค้า / ตรวจรับสินค้า / ผู้ตรวจภายนอก / อื่น ๆ";

export const car: DocTypeDef<CarWording, Car> = {
  id: "iso_car",
  pack: PACK,
  name: "ใบขอให้ปฏิบัติการแก้ไข (CAR)",
  description: "บันทึกปัญหาที่ไม่เป็นไปตามข้อกำหนด การแก้ไขเฉพาะหน้า สาเหตุที่แท้จริง มาตรการป้องกันการเกิดซ้ำ และการติดตามผล",
  facts: [
    { key: "issue", question: "ปัญหาที่พบ (พร้อมหลักฐาน)", required: true, example: "ใบสั่งซื้อ PO-2569-045 ไม่มีตารางเปรียบเทียบราคา" },
    { key: "issuedTo", question: "ส่งถึงหน่วยงานที่ต้องแก้ไข", required: true, example: "ฝ่ายจัดซื้อ" },
    { key: "rootCause", question: "สาเหตุที่แท้จริง (ถ้าสอบสวนแล้ว)", required: false },
    { key: "source", question: `พบจาก (${SOURCES})`, required: false },
    { key: "carNo", question: "เลขที่ CAR", required: false, example: "CAR-2569-012" },
    { key: "issuer", question: "ผู้ออก CAR", required: false },
    { key: "responder", question: "ผู้รับผิดชอบตอบ CAR", required: false },
    { key: "dueDate", question: "กำหนดตอบกลับ", required: false },
    ...CONTROL_FACTS.filter((f) => !["reviewedBy", "revisionHistory"].includes(f.key)),
  ],
  wordingSchema: CarWording,
  guidance: [
    "แยกให้ชัด: การแก้ไขเฉพาะหน้า = แก้ของที่เสียไปแล้ว | มาตรการป้องกันการเกิดซ้ำ = แก้ที่สาเหตุ ไม่ให้เกิดอีก",
    "สาเหตุที่แท้จริงต้องมาจากผู้ใช้ — ห้ามเดา ถ้าไม่มีให้ใส่ [ระบุ: สาเหตุที่แท้จริง] และมาตรการให้ระบุว่าจะกำหนดหลังสอบสวนสาเหตุ",
    "มาตรการแต่ละข้อต้องมีผู้รับผิดชอบ (ตำแหน่ง) และกำหนดเสร็จ",
  ].join("\n"),
  example: {
    request: "ออก CAR ให้ฝ่ายจัดซื้อ จากการตรวจติดตามภายใน พบ PO-2569-045 ไม่มีตารางเปรียบเทียบราคา สอบสวนแล้วสาเหตุคือเจ้าหน้าที่ใหม่ไม่ได้รับการอบรมขั้นตอนจัดซื้อ",
    facts: {
      issue: "ใบสั่งซื้อ PO-2569-045 ไม่มีตารางเปรียบเทียบราคา",
      issuedTo: "ฝ่ายจัดซื้อ",
      source: "ตรวจติดตามภายใน",
      carNo: "CAR-2569-012",
      docNo: "FM-QA-05",
      issuer: "นางตัวอย่าง สอง",
      responder: "นางสาวตัวอย่าง สาม",
    },
    wording: {
      title: "ไม่มีการเปรียบเทียบราคาก่อนออกใบสั่งซื้อ",
      problem: ["จากการตรวจติดตามภายในฝ่ายจัดซื้อ พบใบสั่งซื้อเลขที่ PO-2569-045 ไม่มีตารางเปรียบเทียบราคาจากผู้ขาย 3 รายแนบตามที่ขั้นตอนกำหนด"],
      requirement: "QP-PU-01 การจัดซื้อ ขั้นตอนที่ 3",
      correction: ["ขอใบเสนอราคาเพิ่มเติมและจัดทำตารางเปรียบเทียบราคาย้อนหลังแนบใบสั่งซื้อ PO-2569-045"],
      rootCause: ["เจ้าหน้าที่จัดซื้อที่เริ่มงานใหม่ยังไม่ได้รับการอบรมขั้นตอนการจัดซื้อ QP-PU-01"],
      actions: [
        { action: "จัดอบรมขั้นตอนการจัดซื้อ QP-PU-01 ให้เจ้าหน้าที่จัดซื้อทุกคน", owner: "ผู้จัดการฝ่ายจัดซื้อ", due: "30 พฤศจิกายน 2569" },
        { action: "เพิ่มขั้นตอนอบรมขั้นตอนการทำงานในแผนปฐมนิเทศพนักงานใหม่ของฝ่ายจัดซื้อ", owner: "ผู้จัดการฝ่ายทรัพยากรบุคคล", due: "31 ธันวาคม 2569" },
      ],
      verification: "สุ่มตรวจใบสั่งซื้อ 10 รายการต่อเดือน เป็นเวลา 3 เดือน ต้องมีตารางเปรียบเทียบราคาครบทุกรายการ",
    },
  },

  assemble(w, facts, ctx) {
    return {
      ...w,
      control: controlOf(facts, ctx, "ใบขอให้ปฏิบัติการแก้ไข", "FM-QA-01"),
      info: [
        ["เลขที่ CAR", facts.carNo?.trim() || placeholder("เลขที่ CAR")],
        ["ส่งถึง", facts.issuedTo?.trim() || placeholder("หน่วยงานที่ต้องแก้ไข")],
        ["พบจาก", facts.source?.trim() || placeholder(SOURCES)],
        ["วันที่ออก", thaiDate(ctx.options.date ?? new Date())],
        ["กำหนดตอบกลับ", facts.dueDate?.trim() || placeholder("วันที่")],
      ],
      issuer: facts.issuer?.trim() || placeholder("ผู้ออก CAR"),
      responder: facts.responder?.trim() || placeholder("ผู้รับผิดชอบ"),
    };
  },

  rules: [
    (d) => controlRules(d.control).filter((f) => f.rule !== "ISO_HISTORY"),
    (d): Finding[] => {
      const out: Finding[] = [];
      if (!d.actions.length) out.push({ level: "error", rule: "CAR_ACTIONS", message: "ต้องมีมาตรการป้องกันการเกิดซ้ำอย่างน้อยหนึ่งข้อ", where: "wording.actions" });
      d.actions.forEach((a, i) => {
        if (!a.owner.trim() || !a.due.trim()) out.push({ level: "warning", rule: "CAR_OWNER", message: `มาตรการข้อ ${i + 1} ต้องมีผู้รับผิดชอบและกำหนดเสร็จ`, where: `wording.actions[${i}]` });
      });
      if (!d.rootCause.length || d.rootCause.every((r) => /\[ระบุ/.test(r))) {
        out.push({ level: "warning", rule: "CAR_ROOT_CAUSE", message: "ยังไม่มีสาเหตุที่แท้จริง — มาตรการที่ไม่ได้แก้ที่สาเหตุมักทำให้ปัญหาเกิดซ้ำ", where: "wording.rootCause", ref: "ISO 9001 ข้อ 10.2" });
      }
      return out;
    },
  ],

  layout(d, ctx) {
    const blocks: Block[] = [
      ...section(1, "ข้อมูลทั่วไป", [infoTable(d.info)]),
      ...section(2, "รายละเอียดปัญหา", [...paras(d.problem), para([{ text: "ข้อกำหนดที่ไม่เป็นไปตาม: ", bold: true }, { text: d.requirement }], { indentLeftCm: SPEC.indentCm, spaceBeforePt: 2 })]),
      signTable([["ผู้ออก CAR", d.issuer]]),
      ...section(3, "การแก้ไขเฉพาะหน้า", paras(d.correction)),
      ...section(4, "การวิเคราะห์สาเหตุที่แท้จริง", paras(d.rootCause)),
      ...section(5, "มาตรการป้องกันการเกิดซ้ำ", [grid([1, 8.7, 3.6, 3.2], ["ที่", "มาตรการ", "ผู้รับผิดชอบ", "กำหนดเสร็จ"], d.actions.map((a, i) => [String(i + 1), a.action, a.owner, a.due]), [0])]),
      signTable([["ผู้รับผิดชอบตอบ CAR", d.responder]]),
      ...section(6, "การติดตามผล", [
        ...paras([`วิธีติดตาม: ${d.verification}`]),
        para("ผลการติดตาม:   ☐ มาตรการได้ผล ปิด CAR     ☐ ยังไม่ได้ผล ออก CAR ใหม่เลขที่ ....................", { indentLeftCm: SPEC.indentCm, spaceBeforePt: SPEC.gapPt }),
      ]),
      signTable([["ผู้ติดตามผล", "........................................"], ["ผู้อนุมัติปิด CAR", d.control.approved.name]]),
    ];
    return isoIR(d.title, ctx, d.control, blocks);
  },
};
