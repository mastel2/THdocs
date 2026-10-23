/** นโยบายและวัตถุประสงค์คุณภาพ — คำประกาศของผู้บริหารสูงสุด + เป้าหมายที่วัดผลได้ */
import { blank, para, type DocTypeDef, type Finding } from "@thdocs/core";
import { z } from "zod";
import { CONTROL_FACTS, PACK, SPEC, approvalAndHistory, bullets, controlOf, controlRules, grid, isoIR, paras, section, type Control } from "./common";

export const PolicyWording = z.object({
  title: z.string().describe("ชื่อเอกสาร เช่น 'นโยบายและวัตถุประสงค์คุณภาพ'"),
  statement: z.array(z.string()).describe("ข้อความนโยบาย: องค์กรมุ่งมั่นทำอะไร เพื่อใคร"),
  commitments: z.array(z.string()).describe("ข้อมุ่งมั่น เช่น ปฏิบัติตามข้อกำหนดที่เกี่ยวข้อง ปรับปรุงอย่างต่อเนื่อง"),
  objectives: z
    .array(
      z.object({
        objective: z.string().describe("วัตถุประสงค์"),
        indicator: z.string().describe("ตัวชี้วัด"),
        target: z.string().describe("เป้าหมายที่เป็นตัวเลข เช่น '≥ 95%', 'ไม่เกิน 2 ครั้ง/เดือน'"),
        owner: z.string().describe("ผู้รับผิดชอบ (ตำแหน่ง)"),
        frequency: z.string().describe("ความถี่ในการติดตาม เช่น 'รายเดือน'"),
      }),
    )
    .describe("วัตถุประสงค์คุณภาพที่วัดผลได้"),
});
export type PolicyWording = z.infer<typeof PolicyWording>;
export type Policy = PolicyWording & { control: Control };

export const policy: DocTypeDef<PolicyWording, Policy> = {
  id: "iso_policy",
  pack: PACK,
  name: "นโยบายและวัตถุประสงค์คุณภาพ",
  description: "คำประกาศนโยบายคุณภาพของผู้บริหารสูงสุด และวัตถุประสงค์ที่วัดผลได้พร้อมผู้รับผิดชอบ",
  facts: [
    { key: "business", question: "ธุรกิจ/บริการหลักขององค์กร", required: true, example: "ผลิตชิ้นส่วนพลาสติกสำหรับรถยนต์" },
    { key: "details", question: "สิ่งที่ผู้บริหารต้องการเน้น และเป้าหมายที่มีตัวเลขแล้ว", required: false },
    ...CONTROL_FACTS,
  ],
  wordingSchema: PolicyWording,
  guidance: [
    "นโยบายต้องเหมาะกับธุรกิจขององค์กร สั้น จำง่าย ให้พนักงานทุกระดับเข้าใจได้",
    "วัตถุประสงค์ต้องวัดผลได้: มีตัวชี้วัด เป้าหมายเป็นตัวเลข ผู้รับผิดชอบ และความถี่ในการติดตาม",
    "ใช้ตัวเลขเป้าหมายเฉพาะที่ผู้ใช้ให้มา ถ้าไม่มีให้ใส่ [ระบุ: เป้าหมาย] ห้ามเดาตัวเลข",
  ].join("\n"),
  example: {
    request: "นโยบายคุณภาพบริษัทผลิตชิ้นส่วนพลาสติกรถยนต์ เน้นส่งตรงเวลาและของเสียต่ำ เป้าหมายส่งตรงเวลา 98% ของเสียไม่เกิน 500 ppm ลูกค้าร้องเรียนไม่เกิน 2 ครั้งต่อเดือน",
    facts: { docNo: "QM-01", approvedBy: "นายตัวอย่าง หนึ่ง / กรรมการผู้จัดการ" },
    wording: {
      title: "นโยบายและวัตถุประสงค์คุณภาพ",
      statement: ["บริษัทมุ่งมั่นผลิตชิ้นส่วนพลาสติกที่มีคุณภาพตรงตามความต้องการของลูกค้า ส่งมอบตรงเวลา ด้วยกระบวนการที่ได้รับการปรับปรุงอย่างต่อเนื่อง"],
      commitments: ["ปฏิบัติตามข้อกำหนดของลูกค้าและกฎหมายที่เกี่ยวข้อง", "พัฒนาความรู้และทักษะของพนักงานอย่างสม่ำเสมอ", "ปรับปรุงประสิทธิผลของระบบบริหารคุณภาพอย่างต่อเนื่อง"],
      objectives: [
        { objective: "ส่งมอบสินค้าตรงเวลา", indicator: "ร้อยละการส่งมอบตรงเวลา", target: "≥ 98%", owner: "ผู้จัดการฝ่ายวางแผน", frequency: "รายเดือน" },
        { objective: "ลดของเสียที่ส่งถึงลูกค้า", indicator: "ของเสียต่อล้านชิ้น (ppm)", target: "≤ 500 ppm", owner: "ผู้จัดการฝ่ายผลิต", frequency: "รายเดือน" },
        { objective: "ลดข้อร้องเรียนจากลูกค้า", indicator: "จำนวนข้อร้องเรียน", target: "≤ 2 ครั้ง/เดือน", owner: "ผู้จัดการฝ่ายประกันคุณภาพ", frequency: "รายเดือน" },
      ],
    },
  },

  assemble: (w, facts, ctx) => ({ ...w, control: controlOf(facts, ctx, "นโยบายคุณภาพ", "QM-01") }),

  rules: [
    (d) => controlRules(d.control),
    (d): Finding[] => {
      const out: Finding[] = [];
      if (!d.objectives.length) out.push({ level: "error", rule: "ISO_OBJECTIVES", message: "ต้องมีวัตถุประสงค์คุณภาพอย่างน้อยหนึ่งข้อ", where: "wording.objectives" });
      d.objectives.forEach((o, i) => {
        if (!/[0-9๐-๙]/.test(o.target) && !/\[ระบุ/.test(o.target)) {
          out.push({ level: "warning", rule: "ISO_MEASURABLE", message: `วัตถุประสงค์ข้อ ${i + 1} ยังไม่มีเป้าหมายที่เป็นตัวเลข จึงวัดผลไม่ได้`, where: `wording.objectives[${i}].target`, ref: "ISO 9001 ข้อ 6.2 (วัตถุประสงค์ต้องวัดผลได้)" });
        }
      });
      return out;
    },
  ],

  layout(d, ctx) {
    const a = d.control.approved;
    const blocks = [
      ...section(1, "นโยบายคุณภาพ", paras(d.statement)),
      ...section(2, "ข้อมุ่งมั่น", bullets(d.commitments)),
      ...section(3, "วัตถุประสงค์คุณภาพ", [
        grid([4.4, 3.6, 2.6, 3.3, 2.6], ["วัตถุประสงค์", "ตัวชี้วัด", "เป้าหมาย", "ผู้รับผิดชอบ", "ความถี่ติดตาม"], d.objectives.map((o) => [o.objective, o.indicator, o.target, o.owner, o.frequency]), [2, 4]),
      ]),
      // ผู้บริหารสูงสุดลงนามประกาศนโยบาย
      blank(2, true),
      para(`(${a.name})`, { align: "center", indentLeftCm: 7, keepWithNext: true }),
      para(a.position, { align: "center", indentLeftCm: 7, spaceAfterPt: SPEC.gapPt }),
      ...approvalAndHistory(d.control, 4),
    ];
    return isoIR(d.title, ctx, d.control, blocks);
  },
};
