/** แบบฟอร์ม / รายการตรวจ (Form / Checklist) — บันทึกที่ใช้เป็นหลักฐานการปฏิบัติงาน */
import { cell, para, type Block, type DocTypeDef, type Finding } from "@thdocs/core";
import { z } from "zod";
import { CONTROL_FACTS, PACK, SPEC, controlOf, controlRules, isoIR, type Control } from "./common";

export const FormWording = z.object({
  title: z.string().describe("ชื่อแบบฟอร์ม เช่น 'รายการตรวจความปลอดภัยประจำวัน'"),
  instructions: z.array(z.string()).describe("คำชี้แจงการกรอก (ไม่มีให้เป็น [])"),
  fields: z.array(z.string()).describe("ช่องข้อมูลทั่วไปด้านบน เช่น 'วันที่ตรวจ', 'ผู้ตรวจ', 'พื้นที่'"),
  items: z.array(z.object({ item: z.string().describe("รายการที่ตรวจ"), criterion: z.string().describe("เกณฑ์ที่ถือว่าผ่าน") })).describe("รายการตรวจ"),
});
export type FormWording = z.infer<typeof FormWording>;
export type Form = FormWording & { control: Control };

export const form: DocTypeDef<FormWording, Form> = {
  id: "iso_form",
  pack: PACK,
  name: "แบบฟอร์ม / รายการตรวจ (Checklist)",
  description: "แบบฟอร์มบันทึกผลการตรวจหรือการปฏิบัติงาน มีช่องผ่าน/ไม่ผ่าน และหมายเหตุ",
  facts: [
    { key: "subject", question: "ตรวจหรือบันทึกเรื่องอะไร", required: true, example: "ความปลอดภัยในพื้นที่ผลิตประจำวัน" },
    { key: "details", question: "รายการที่ต้องตรวจและเกณฑ์ผ่าน", required: false },
    ...CONTROL_FACTS,
  ],
  wordingSchema: FormWording,
  guidance: [
    "รายการตรวจแต่ละข้อต้องตรวจได้จริงด้วยการมองหรือวัด และมีเกณฑ์ผ่านที่ชัดเจน ไม่กำกวม",
    "เรียงรายการตามลำดับที่ผู้ตรวจเดินตรวจจริง",
  ].join("\n"),
  example: {
    request: "แบบตรวจความปลอดภัยพื้นที่ผลิตประจำวัน: ทางหนีไฟไม่มีของกีดขวาง ถังดับเพลิงแรงดันปกติ พนักงานสวมอุปกรณ์ป้องกัน การ์ดเครื่องจักรอยู่ครบ",
    facts: { docNo: "FM-SH-02", preparedBy: "นายตัวอย่าง ห้า / เจ้าหน้าที่ความปลอดภัย", approvedBy: "นายตัวอย่าง หนึ่ง / กรรมการผู้จัดการ" },
    wording: {
      title: "รายการตรวจความปลอดภัยพื้นที่ผลิตประจำวัน",
      instructions: ["ตรวจก่อนเริ่มงานกะเช้า ทำเครื่องหมาย ✓ ในช่องผล หากไม่ผ่านให้ระบุการแก้ไขในหมายเหตุและแจ้งหัวหน้างานทันที"],
      fields: ["วันที่ตรวจ", "ผู้ตรวจ", "พื้นที่"],
      items: [
        { item: "ทางหนีไฟและประตูหนีไฟ", criterion: "ไม่มีสิ่งกีดขวาง เปิดได้" },
        { item: "ถังดับเพลิง", criterion: "เข็มแรงดันอยู่ในช่องสีเขียว" },
        { item: "อุปกรณ์ป้องกันส่วนบุคคลของพนักงาน", criterion: "สวมครบตามป้ายกำหนด" },
        { item: "การ์ดป้องกันเครื่องจักร", criterion: "ติดตั้งครบ ไม่ชำรุด" },
      ],
    },
  },

  assemble: (w, facts, ctx) => ({ ...w, control: controlOf(facts, ctx, "แบบฟอร์ม", "FM-QA-01") }),

  rules: [
    (d) => controlRules(d.control),
    (d): Finding[] => (d.items.length ? [] : [{ level: "error", rule: "ISO_ITEMS", message: "ต้องมีรายการตรวจอย่างน้อยหนึ่งรายการ", where: "wording.items" }]),
  ],

  layout(d, ctx) {
    const head = ["ที่", "รายการตรวจ", "เกณฑ์", "ผ่าน", "ไม่ผ่าน", "หมายเหตุ"];
    const blocks: Block[] = [
      para([{ text: d.title, bold: true }], { align: "center", spaceAfterPt: SPEC.gapPt }),
      ...d.fields.map((f) => para(`${f}: ............................................................`, { spaceBeforePt: 2 })),
      ...d.instructions.map((t) => para([{ text: "คำชี้แจง: ", bold: true }, { text: t }], { spaceBeforePt: SPEC.gapPt })),
      {
        kind: "table",
        columnsCm: [1, 5.6, 4.4, 1.3, 1.5, 2.7],
        spaceBeforePt: SPEC.gapPt,
        rows: [
          { header: true, cells: head.map((h) => cell(h, { bold: true, align: "center", shade: SPEC.shade })) },
          ...d.items.map((x, i) => ({
            cells: [cell(String(i + 1), { align: "center" }), cell(x.item), cell(x.criterion), cell("☐", { align: "center" }), cell("☐", { align: "center" }), cell("")],
          })),
        ],
      },
      // แบบฟอร์มที่ใช้งานจริงไม่พิมพ์ตารางอนุมัติ/ประวัติแก้ไข — ข้อมูลควบคุมอยู่ที่หัวกระดาษแทน
      para("ลงชื่อผู้ตรวจ ..................................................  ลงชื่อหัวหน้างาน ..................................................", { spaceBeforePt: SPEC.gapPt * 3 }),
    ];
    return isoIR(d.title, ctx, d.control, blocks);
  },
};
