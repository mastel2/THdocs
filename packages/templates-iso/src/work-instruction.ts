/** วิธีปฏิบัติงาน (Work Instruction / WI) — วิธีทำงานหนึ่งงานแบบทีละขั้น สำหรับผู้ปฏิบัติหน้างาน */
import type { DocTypeDef, Finding } from "@thdocs/core";
import { z } from "zod";
import { CONTROL_FACTS, PACK, approvalAndHistory, bullets, controlOf, controlRules, grid, isoIR, paras, section, type Control } from "./common";

export const WorkInstructionWording = z.object({
  title: z.string().describe("ชื่องาน เช่น 'การสำรองข้อมูลเซิร์ฟเวอร์ประจำวัน'"),
  purpose: z.array(z.string()).describe("วัตถุประสงค์"),
  scope: z.array(z.string()).describe("ขอบเขต: ใช้กับงาน/เครื่อง/พื้นที่ใด"),
  tools: z.array(z.string()).describe("อุปกรณ์ เครื่องมือ หรือสิ่งที่ต้องเตรียม (ไม่มีให้เป็น [])"),
  steps: z
    .array(z.object({ action: z.string().describe("สิ่งที่ต้องทำ เริ่มด้วยคำกริยา"), keyPoint: z.string().describe("จุดสำคัญ/เกณฑ์ที่ต้องได้/ข้อควรระวัง ('-' ถ้าไม่มี)") }))
    .describe("วิธีปฏิบัติทีละขั้น"),
  cautions: z.array(z.string()).describe("ข้อควรระวังด้านความปลอดภัยหรือคุณภาพ (ไม่มีให้เป็น [])"),
  records: z.array(z.string()).describe("บันทึกที่ต้องทำ (ไม่มีให้เป็น [])"),
});
export type WorkInstructionWording = z.infer<typeof WorkInstructionWording>;
export type WorkInstruction = WorkInstructionWording & { control: Control };

export const workInstruction: DocTypeDef<WorkInstructionWording, WorkInstruction> = {
  id: "iso_work_instruction",
  pack: PACK,
  name: "วิธีปฏิบัติงาน (Work Instruction)",
  description: "คู่มือทำงานหนึ่งงานแบบทีละขั้น พร้อมจุดสำคัญและข้อควรระวัง สำหรับผู้ปฏิบัติหน้างาน",
  facts: [
    { key: "task", question: "งานอะไร", required: true, example: "การสำรองข้อมูลเซิร์ฟเวอร์ประจำวัน" },
    { key: "details", question: "ขั้นตอนโดยย่อ อุปกรณ์ที่ใช้ ข้อควรระวัง", required: false },
    ...CONTROL_FACTS,
  ],
  wordingSchema: WorkInstructionWording,
  guidance: [
    "เขียนให้ผู้ปฏิบัติหน้างานทำตามได้ทันที: หนึ่งขั้นหนึ่งการกระทำ เริ่มด้วยคำกริยา",
    "จุดสำคัญ (keyPoint) บอกเกณฑ์ที่ต้องได้หรือสิ่งที่ห้ามพลาด เช่น ค่าที่ต้องตรวจ ตำแหน่งที่ต้องกด",
    "ห้ามแต่งค่าทางเทคนิคที่ผู้ใช้ไม่ได้ให้ ใช้ [ระบุ: ...] แทน",
  ].join("\n"),
  example: {
    request: "วิธีสำรองข้อมูลเซิร์ฟเวอร์ทุกวันตอน 18.00 ตรวจว่างานสำรองสำเร็จ เปลี่ยนเทปทุกวันศุกร์ เก็บเทปในตู้กันไฟ",
    facts: { docNo: "WI-IT-03", preparedBy: "นายตัวอย่าง สี่ / เจ้าหน้าที่ไอที", approvedBy: "นายตัวอย่าง หนึ่ง / กรรมการผู้จัดการ" },
    wording: {
      title: "การสำรองข้อมูลเซิร์ฟเวอร์ประจำวัน",
      purpose: ["เพื่อให้ข้อมูลของบริษัทกู้คืนได้เมื่อเกิดเหตุขัดข้อง"],
      scope: ["ใช้กับเซิร์ฟเวอร์ไฟล์และฐานข้อมูลของสำนักงานใหญ่"],
      tools: ["ซอฟต์แวร์สำรองข้อมูล", "เทปสำรองข้อมูล", "แบบบันทึกการสำรองข้อมูล"],
      steps: [
        { action: "ตรวจสอบในซอฟต์แวร์สำรองข้อมูลว่างานสำรองประจำวันเวลา 18.00 น. ทำงานสำเร็จ", keyPoint: "สถานะต้องเป็น 'สำเร็จ' หากล้มเหลวให้สั่งสำรองใหม่ทันที" },
        { action: "บันทึกผลลงแบบบันทึกการสำรองข้อมูล", keyPoint: "ลงวันที่ เวลา สถานะ และชื่อผู้ตรวจ" },
        { action: "ทุกวันศุกร์ ถอดเทปสำรองข้อมูลและใส่เทปชุดใหม่", keyPoint: "ติดป้ายวันที่บนเทปก่อนจัดเก็บ" },
        { action: "นำเทปที่ถอดออกไปเก็บในตู้กันไฟ", keyPoint: "ล็อกตู้ทุกครั้ง" },
      ],
      cautions: ["ห้ามปิดเซิร์ฟเวอร์ระหว่างงานสำรองข้อมูลทำงาน"],
      records: ["แบบบันทึกการสำรองข้อมูล"],
    },
  },

  assemble: (w, facts, ctx) => ({ ...w, control: controlOf(facts, ctx, "วิธีปฏิบัติงาน", "WI-IT-01") }),

  rules: [
    (d) => controlRules(d.control),
    (d): Finding[] => (d.steps.length ? [] : [{ level: "error", rule: "ISO_STEPS", message: "ต้องมีวิธีปฏิบัติอย่างน้อยหนึ่งขั้น", where: "wording.steps" }]),
  ],

  layout(d, ctx) {
    const blocks = [
      ...section(1, "วัตถุประสงค์", paras(d.purpose)),
      ...section(2, "ขอบเขต", paras(d.scope)),
      ...section(3, "อุปกรณ์ / สิ่งที่ต้องเตรียม", bullets(d.tools)),
      ...section(4, "วิธีปฏิบัติงาน", [grid([1.3, 9, 6.2], ["ขั้นที่", "วิธีปฏิบัติ", "จุดสำคัญ / ข้อควรระวัง"], d.steps.map((s, i) => [String(i + 1), s.action, s.keyPoint || "-"]), [0])]),
      ...section(5, "ข้อควรระวัง", bullets(d.cautions)),
      ...section(6, "บันทึกที่เกี่ยวข้อง", bullets(d.records)),
      ...approvalAndHistory(d.control, 7),
    ];
    return isoIR(d.title, ctx, d.control, blocks);
  },
};
