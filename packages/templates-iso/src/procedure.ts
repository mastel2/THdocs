/** ขั้นตอนการปฏิบัติงาน (Procedure / QP) — กระบวนการ ใครทำอะไร เมื่อไร และบันทึกอะไรเป็นหลักฐาน */
import type { DocTypeDef, Finding } from "@thdocs/core";
import { z } from "zod";
import { CONTROL_FACTS, PACK, approvalAndHistory, bullets, controlOf, controlRules, grid, isoIR, paras, section, type Control } from "./common";

export const ProcedureWording = z.object({
  title: z.string().describe("ชื่อเอกสาร เช่น 'การควบคุมเอกสารและบันทึก'"),
  purpose: z.array(z.string()).describe("วัตถุประสงค์ของขั้นตอนนี้"),
  scope: z.array(z.string()).describe("ขอบเขต: ใช้กับงาน/หน่วยงานใด เริ่มและสิ้นสุดที่ใด"),
  definitions: z.array(z.object({ term: z.string().describe("คำ"), meaning: z.string().describe("ความหมาย") })).describe("คำนิยามที่ใช้ในเอกสาร (ไม่มีให้เป็น [])"),
  responsibilities: z.array(z.object({ role: z.string().describe("ตำแหน่ง"), duty: z.string().describe("หน้าที่ความรับผิดชอบ") })).describe("ตำแหน่งและหน้าที่ความรับผิดชอบ"),
  steps: z
    .array(z.object({ step: z.string().describe("ขั้นตอนและรายละเอียด"), responsible: z.string().describe("ตำแหน่งผู้รับผิดชอบ"), record: z.string().describe("เอกสาร/บันทึกที่เกิดขึ้น ('-' ถ้าไม่มี)") }))
    .describe("ขั้นตอนการปฏิบัติงานตามลำดับ"),
  references: z.array(z.string()).describe("เอกสารอ้างอิง (ไม่มีให้เป็น [])"),
  records: z.array(z.string()).describe("แบบฟอร์ม/บันทึกที่เกี่ยวข้อง พร้อมรหัสถ้ามี (ไม่มีให้เป็น [])"),
});
export type ProcedureWording = z.infer<typeof ProcedureWording>;
export type Procedure = ProcedureWording & { control: Control };

export const procedure: DocTypeDef<ProcedureWording, Procedure> = {
  id: "iso_procedure",
  pack: PACK,
  name: "ขั้นตอนการปฏิบัติงาน (Procedure)",
  description: "เอกสารระบบคุณภาพที่ระบุกระบวนการ ผู้รับผิดชอบแต่ละขั้น และบันทึกที่ต้องเก็บเป็นหลักฐาน",
  facts: [
    { key: "process", question: "กระบวนการอะไร", required: true, example: "การจัดซื้อจัดจ้าง" },
    { key: "details", question: "ลำดับงานโดยย่อ และใครทำแต่ละขั้น", required: false },
    ...CONTROL_FACTS,
  ],
  wordingSchema: ProcedureWording,
  guidance: [
    "เขียนเป็นเอกสารระบบคุณภาพที่ใช้ปฏิบัติได้จริง: กระชับ ใช้ภาษาสั่งการ ระบุผู้รับผิดชอบเป็นตำแหน่ง ไม่ใช่ชื่อคน",
    "ขั้นตอนเรียงตามลำดับเวลา แต่ละขั้นมีผู้รับผิดชอบเพียงตำแหน่งหลักเดียว และระบุบันทึกที่เกิดขึ้นเพื่อใช้เป็นหลักฐาน",
    "ห้ามอ้างหรือคัดลอกข้อความของมาตรฐาน ISO; ห้ามแต่งรหัสแบบฟอร์มที่ผู้ใช้ไม่ได้ให้ ใช้ [ระบุ: รหัสแบบฟอร์ม] แทน",
  ].join("\n"),
  example: {
    request: "ขั้นตอนการจัดซื้อ: ผู้ขอซื้อเขียนใบขอซื้อ หัวหน้าแผนกอนุมัติ จัดซื้อขอใบเสนอราคา 3 ราย เลือกผู้ขาย ออกใบสั่งซื้อ คลังตรวจรับสินค้า",
    facts: { docNo: "QP-PU-01", preparedBy: "นางสาวตัวอย่าง สาม / เจ้าหน้าที่จัดซื้อ", reviewedBy: "นางตัวอย่าง สอง / ผู้จัดการฝ่ายบัญชีและการเงิน", approvedBy: "นายตัวอย่าง หนึ่ง / กรรมการผู้จัดการ" },
    wording: {
      title: "การจัดซื้อ",
      purpose: ["เพื่อให้การจัดซื้อสินค้าและบริการเป็นไปอย่างโปร่งใส ได้ของที่ตรงตามความต้องการ ในราคาที่เหมาะสม"],
      scope: ["ครอบคลุมการจัดซื้อสินค้าและบริการทุกประเภทของบริษัท ตั้งแต่การขอซื้อจนถึงการตรวจรับ"],
      definitions: [{ term: "ผู้ขอซื้อ", meaning: "พนักงานที่มีความต้องการใช้สินค้าหรือบริการ" }],
      responsibilities: [
        { role: "หัวหน้าแผนก", duty: "พิจารณาอนุมัติใบขอซื้อของแผนก" },
        { role: "เจ้าหน้าที่จัดซื้อ", duty: "จัดหาผู้ขาย เปรียบเทียบราคา และออกใบสั่งซื้อ" },
        { role: "เจ้าหน้าที่คลังสินค้า", duty: "ตรวจรับสินค้าให้ตรงตามใบสั่งซื้อ" },
      ],
      steps: [
        { step: "จัดทำใบขอซื้อ ระบุรายการ จำนวน และวันที่ต้องการ", responsible: "ผู้ขอซื้อ", record: "ใบขอซื้อ" },
        { step: "พิจารณาอนุมัติใบขอซื้อ", responsible: "หัวหน้าแผนก", record: "ใบขอซื้อที่ลงนามแล้ว" },
        { step: "ขอใบเสนอราคาจากผู้ขายอย่างน้อย 3 ราย และเปรียบเทียบราคา", responsible: "เจ้าหน้าที่จัดซื้อ", record: "ตารางเปรียบเทียบราคา" },
        { step: "ออกใบสั่งซื้อให้ผู้ขายที่ได้รับคัดเลือก", responsible: "เจ้าหน้าที่จัดซื้อ", record: "ใบสั่งซื้อ" },
        { step: "ตรวจรับสินค้าให้ตรงตามใบสั่งซื้อ หากไม่ตรงให้แจ้งจัดซื้อภายใน 1 วันทำการ", responsible: "เจ้าหน้าที่คลังสินค้า", record: "ใบตรวจรับสินค้า" },
      ],
      references: [],
      records: ["ใบขอซื้อ", "ตารางเปรียบเทียบราคา", "ใบสั่งซื้อ", "ใบตรวจรับสินค้า"],
    },
  },

  assemble: (w, facts, ctx) => ({ ...w, control: controlOf(facts, ctx, "ขั้นตอนการปฏิบัติงาน", "QP-HR-01") }),

  rules: [
    (d) => controlRules(d.control),
    (d): Finding[] => {
      const out: Finding[] = [];
      if (!d.steps.length) out.push({ level: "error", rule: "ISO_STEPS", message: "ต้องมีขั้นตอนการปฏิบัติงานอย่างน้อยหนึ่งขั้น", where: "wording.steps" });
      d.steps.forEach((s, i) => {
        if (!s.responsible.trim()) out.push({ level: "warning", rule: "ISO_OWNER", message: `ขั้นตอนที่ ${i + 1} ยังไม่ระบุผู้รับผิดชอบ`, where: `wording.steps[${i}]` });
      });
      return out;
    },
  ],

  layout(d, ctx) {
    const blocks = [
      ...section(1, "วัตถุประสงค์", paras(d.purpose)),
      ...section(2, "ขอบเขต", paras(d.scope)),
      ...section(3, "คำนิยาม", d.definitions.length ? [grid([4.5, 12], ["คำ", "ความหมาย"], d.definitions.map((x) => [x.term, x.meaning]))] : bullets([])),
      ...section(4, "ความรับผิดชอบ", [grid([4.5, 12], ["ตำแหน่ง", "หน้าที่ความรับผิดชอบ"], d.responsibilities.map((x) => [x.role, x.duty]))]),
      ...section(5, "ขั้นตอนการปฏิบัติงาน", [
        grid([1.3, 8.2, 3.5, 3.5], ["ลำดับ", "ขั้นตอน / รายละเอียด", "ผู้รับผิดชอบ", "เอกสาร / บันทึก"], d.steps.map((s, i) => [String(i + 1), s.step, s.responsible, s.record || "-"]), [0]),
      ]),
      ...section(6, "เอกสารอ้างอิง", bullets(d.references)),
      ...section(7, "แบบฟอร์ม / บันทึกที่เกี่ยวข้อง", bullets(d.records)),
      ...approvalAndHistory(d.control, 8),
    ];
    return isoIR(d.title, ctx, d.control, blocks);
  },
};
