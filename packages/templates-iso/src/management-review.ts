/** รายงานการประชุมทบทวนของฝ่ายบริหาร (Management Review) — วาระ ผลการพิจารณา และตารางมติพร้อมผู้รับผิดชอบ */
import { para, placeholder, thaiDate, type Block, type DocTypeDef, type Finding } from "@thdocs/core";
import { z } from "zod";
import { CONTROL_FACTS, PACK, bullets, controlOf, controlRules, grid, infoTable, isoIR, paras, section, signTable, type Control } from "./common";

export const ManagementReviewWording = z.object({
  title: z.string().describe("ชื่อเรื่องสั้น ๆ ไม่ต้องขึ้นต้นด้วยชนิดเอกสาร เช่น 'ครั้งที่ 1/2569'"),
  agenda: z
    .array(z.object({ topic: z.string().describe("หัวข้อที่ทบทวน"), discussion: z.array(z.string()).describe("ผลการดำเนินงาน/ประเด็นที่พิจารณา"), resolution: z.string().describe("ข้อสรุปของที่ประชุม — ไม่มีข้อมูลให้ใส่ [ระบุ: ข้อสรุป]") }))
    .describe("หัวข้อที่ทบทวนตามลำดับ"),
  actions: z
    .array(z.object({ action: z.string().describe("สิ่งที่ต้องดำเนินการ"), owner: z.string().describe("ผู้รับผิดชอบ (ตำแหน่ง)"), due: z.string().describe("กำหนดเสร็จ — ไม่ทราบให้ใส่ [ระบุ: วันที่]") }))
    .describe("มติ/การดำเนินการที่ได้จากการทบทวน"),
});
export type ManagementReviewWording = z.infer<typeof ManagementReviewWording>;
export type ManagementReview = ManagementReviewWording & { control: Control; info: [string, string][]; attendees: string[]; chair: string; recorder: string };

/** หัวข้อที่การทบทวนของฝ่ายบริหารมักครอบคลุม — เขียนเองเป็นภาษาทั่วไป */
const TYPICAL_TOPICS = [
  "การติดตามมติจากการทบทวนครั้งก่อน",
  "การเปลี่ยนแปลงของปัจจัยภายในและภายนอกที่กระทบระบบ",
  "ผลการดำเนินงานเทียบวัตถุประสงค์คุณภาพ",
  "ความพึงพอใจและข้อร้องเรียนของลูกค้า",
  "ผลการตรวจติดตาม และสถานะการแก้ไขข้อบกพร่อง",
  "ผลงานของผู้ขาย/ผู้ให้บริการภายนอก",
  "ความเพียงพอของทรัพยากร",
  "ความเสี่ยงและโอกาส และโอกาสในการปรับปรุง",
];

export const managementReview: DocTypeDef<ManagementReviewWording, ManagementReview> = {
  id: "iso_management_review",
  pack: PACK,
  name: "รายงานการทบทวนของฝ่ายบริหาร (Management Review)",
  description: "รายงานการประชุมผู้บริหารเพื่อทบทวนระบบบริหารคุณภาพ พร้อมมติ ผู้รับผิดชอบ และกำหนดเสร็จ",
  facts: [
    { key: "content", question: "ผลการดำเนินงานและประเด็นที่ประชุม (แต่ละหัวข้อได้ผลอย่างไร มีมติอะไร)", required: true },
    { key: "session", question: "ครั้งที่", required: false, example: "1/2569" },
    { key: "meetingDate", question: "วันที่ประชุม (ไม่ระบุ = วันนี้)", required: false },
    { key: "place", question: "สถานที่", required: false },
    { key: "attendees", question: "ผู้เข้าประชุม (บรรทัดละคน: ชื่อ ตำแหน่ง — คนแรกเป็นประธาน)", required: false },
    { key: "recorder", question: "ผู้บันทึกการประชุม", required: false },
    ...CONTROL_FACTS.filter((f) => !["reviewedBy", "revisionHistory"].includes(f.key)),
  ],
  wordingSchema: ManagementReviewWording,
  guidance: [
    `หัวข้อที่มักทบทวน (ใช้เฉพาะหัวข้อที่ผู้ใช้มีข้อมูล): ${TYPICAL_TOPICS.join(" / ")}`,
    "แต่ละหัวข้อสรุปผลเทียบเป้าหมายเป็นตัวเลขเมื่อผู้ใช้ให้มา และระบุข้อสรุปของที่ประชุม",
    "มติที่ต้องดำเนินการต้องอยู่ใน actions พร้อมผู้รับผิดชอบและกำหนดเสร็จ",
    "ห้ามแต่งตัวเลขผลการดำเนินงาน ใช้ [ระบุ: ...] แทน; ห้ามคัดลอกข้อความของมาตรฐาน ISO",
  ].join("\n"),
  example: {
    request: "ทบทวนฝ่ายบริหารครั้งที่ 1/2569 ส่งตรงเวลาได้ 96% ต่ำกว่าเป้า 98% เพราะเครื่องฉีดเสีย ข้อร้องเรียน 1 ครั้งต่อเดือน ผ่านเป้า ตรวจติดตามพบข้อบกพร่องย่อย 2 ข้อ แก้ไขแล้ว 1 ข้อ มติให้ซื้อแม่พิมพ์สำรองและทำแผนบำรุงรักษาเชิงป้องกัน",
    facts: {
      session: "1/2569",
      place: "ห้องประชุมผู้บริหาร",
      attendees: "นายตัวอย่าง หนึ่ง กรรมการผู้จัดการ\nนางตัวอย่าง สอง ผู้จัดการฝ่ายบัญชีและการเงิน\nนายตัวอย่าง หก ผู้จัดการฝ่ายผลิต",
      recorder: "นางสาวตัวอย่าง สาม",
      docNo: "FM-MR-01",
    },
    wording: {
      title: "ครั้งที่ 1/2569",
      agenda: [
        { topic: "ผลการดำเนินงานเทียบวัตถุประสงค์คุณภาพ", discussion: ["การส่งมอบตรงเวลาได้ร้อยละ 96 ต่ำกว่าเป้าหมายร้อยละ 98 เนื่องจากเครื่องฉีดพลาสติกเครื่องที่ 3 ขัดข้อง", "ข้อร้องเรียนจากลูกค้าเฉลี่ย 1 ครั้งต่อเดือน เป็นไปตามเป้าหมาย"], resolution: "ให้ฝ่ายผลิตจัดทำแผนบำรุงรักษาเชิงป้องกันและจัดหาแม่พิมพ์สำรอง" },
        { topic: "ผลการตรวจติดตาม และสถานะการแก้ไขข้อบกพร่อง", discussion: ["การตรวจติดตามภายในพบข้อบกพร่องย่อย 2 ข้อ แก้ไขแล้วเสร็จ 1 ข้อ อีก 1 ข้ออยู่ระหว่างดำเนินการ"], resolution: "รับทราบ และให้ติดตามข้อที่เหลือให้แล้วเสร็จภายในกำหนด" },
      ],
      actions: [
        { action: "จัดทำแผนบำรุงรักษาเชิงป้องกันเครื่องฉีดพลาสติก", owner: "ผู้จัดการฝ่ายผลิต", due: "30 พฤศจิกายน 2569" },
        { action: "จัดซื้อแม่พิมพ์สำรองสำหรับชิ้นส่วนหลัก", owner: "ผู้จัดการฝ่ายผลิต", due: "31 ธันวาคม 2569" },
      ],
    },
  },

  assemble(w, facts, ctx) {
    const attendees = (facts.attendees ?? "").split("\n").map((s) => s.trim()).filter(Boolean);
    return {
      ...w,
      control: controlOf(facts, ctx, "รายงานการทบทวนของฝ่ายบริหาร", "FM-MR-01"),
      info: [
        ["ครั้งที่", facts.session?.trim() || placeholder("ครั้งที่")],
        ["วันที่ประชุม", facts.meetingDate?.trim() || thaiDate(ctx.options.date ?? new Date())],
        ["สถานที่", facts.place?.trim() || placeholder("สถานที่")],
      ],
      attendees,
      chair: attendees[0]?.split(/\s+/).slice(0, 2).join(" ") || placeholder("ประธานที่ประชุม"),
      recorder: facts.recorder?.trim() || placeholder("ผู้บันทึกการประชุม"),
    };
  },

  rules: [
    (d) => controlRules(d.control).filter((f) => f.rule !== "ISO_HISTORY"),
    (d): Finding[] => {
      const out: Finding[] = [];
      if (!d.agenda.length) out.push({ level: "error", rule: "MR_AGENDA", message: "ต้องมีหัวข้อที่ทบทวนอย่างน้อยหนึ่งหัวข้อ", where: "wording.agenda" });
      if (!d.attendees.length) out.push({ level: "warning", rule: "MR_ATTENDEES", message: "ยังไม่มีรายชื่อผู้เข้าประชุม", where: "facts.attendees" });
      d.actions.forEach((a, i) => {
        if (!a.owner.trim() || !a.due.trim()) out.push({ level: "warning", rule: "MR_ACTION", message: `มติข้อ ${i + 1} ต้องมีผู้รับผิดชอบและกำหนดเสร็จ`, where: `wording.actions[${i}]` });
      });
      return out;
    },
  ],

  layout(d, ctx) {
    const blocks: Block[] = [
      ...section(1, "ข้อมูลการประชุม", [infoTable(d.info)]),
      ...section(2, "ผู้เข้าประชุม", bullets(d.attendees, placeholder("รายชื่อผู้เข้าประชุม"))),
      ...section(
        3,
        "ผลการทบทวน",
        d.agenda.flatMap((a, i): Block[] => [
          para([{ text: `3.${i + 1} ${a.topic}`, bold: true }], { indentLeftCm: 0.75, spaceBeforePt: 6, keepWithNext: true }),
          ...paras(a.discussion),
          para([{ text: "ข้อสรุป: ", bold: true }, { text: a.resolution }], { indentLeftCm: 0.75, spaceBeforePt: 2 }),
        ]),
      ),
      ...section(4, "มติและการดำเนินการ", [grid([1, 8.7, 3.6, 3.2], ["ที่", "การดำเนินการ", "ผู้รับผิดชอบ", "กำหนดเสร็จ"], d.actions.map((a, i) => [String(i + 1), a.action, a.owner, a.due]), [0])]),
      signTable([
        ["ผู้บันทึกการประชุม", d.recorder],
        ["ประธานที่ประชุม", d.chair],
      ]),
    ];
    return isoIR(d.title, ctx, d.control, blocks);
  },
};
