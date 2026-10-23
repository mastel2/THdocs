/** รายงานการประชุม — ระเบียบงานสารบรรณ ข้อ ๒๕ (ไม่ใช้กระดาษตราครุฑ) */
import { blank, para, placeholder, type Block, type DocTypeDef, type Finding } from "@thdocs/core";
import { z } from "zod";
import { PACK, dateOf, lines, yearBE } from "./common";
import { SPEC, bodyParas, centered, docIR, separator } from "./layout";

export const MinutesWording = z.object({
  agenda: z
    .array(
      z.object({
        title: z.string().describe("ชื่อระเบียบวาระ เช่น 'เรื่องที่ประธานแจ้งให้ที่ประชุมทราบ'"),
        discussion: z.array(z.string()).describe("สาระการพิจารณา แต่ละข้อคือหนึ่งย่อหน้า"),
        resolution: z.string().describe("มติหรือข้อสรุปของที่ประชุม — ถ้าไม่มีข้อมูลให้ใส่ [ระบุ: มติที่ประชุม]"),
      }),
    )
    .describe("ระเบียบวาระตามลำดับ"),
});
export type MinutesWording = z.infer<typeof MinutesWording>;

export interface Minutes extends MinutesWording {
  meetingName: string;
  session: string;
  when: string;
  place: string;
  attendees: string[];
  absentees: string[];
  others: string[];
  start: string;
  end: string;
  recorder: string;
}

const REF = (n: string) => `ระเบียบงานสารบรรณ ข้อ ๒๕.${n}`;
const time = (s: string | null | undefined) => {
  const t = s?.trim();
  if (!t) return `${placeholder("เวลา")} น.`;
  return /น\.?$/.test(t) ? t : `${t} น.`;
};

export const minutes: DocTypeDef<MinutesWording, Minutes> = {
  id: "minutes",
  pack: PACK,
  name: "รายงานการประชุม",
  description: "การบันทึกความคิดเห็นของผู้มาประชุม ผู้เข้าร่วมประชุม และมติของที่ประชุม",
  facts: [
    { key: "meetingName", question: "ชื่อคณะที่ประชุมหรือชื่อการประชุม", required: true, example: "คณะกรรมการบริหารสำนักงานตัวอย่าง" },
    { key: "content", question: "สาระการประชุม: แต่ละวาระคุยเรื่องอะไร และมีมติอย่างไร", required: true },
    { key: "session", question: "ครั้งที่", required: false, example: "5/2569" },
    { key: "meetingDate", question: "วันที่ประชุม", required: false, example: "วันพฤหัสบดีที่ 23 ตุลาคม 2569" },
    { key: "place", question: "สถานที่ประชุม", required: false },
    { key: "attendees", question: "ผู้มาประชุม (บรรทัดละคน: ชื่อ ตำแหน่ง)", required: false },
    { key: "absentees", question: "ผู้ไม่มาประชุม (บรรทัดละคน พร้อมเหตุผล ถ้ามี)", required: false },
    { key: "others", question: "ผู้เข้าร่วมประชุม (ไม่ใช่องค์ประชุม บรรทัดละคน)", required: false },
    { key: "startTime", question: "เวลาเริ่มประชุม", required: false, example: "09.30" },
    { key: "endTime", question: "เวลาเลิกประชุม", required: false, example: "12.00" },
    { key: "recorder", question: "ผู้จดรายงานการประชุม (ชื่อ)", required: false },
  ],
  wordingSchema: MinutesWording,
  guidance: [
    "เรียงตามระเบียบวาระ: เรื่องที่ประธานแจ้งให้ที่ประชุมทราบ → รับรองรายงานการประชุมครั้งที่แล้ว → เรื่องสืบเนื่อง → เรื่องเพื่อพิจารณา → เรื่องอื่น ๆ (ใช้เฉพาะวาระที่มีเนื้อหาจริง)",
    "สรุปสาระสำคัญ ไม่ต้องจดคำต่อคำ; มติที่ไม่มีในข้อมูลให้ใส่ [ระบุ: มติที่ประชุม]",
    "ไม่ต้องเขียนรายชื่อผู้มาประชุม เวลา หรือผู้จดรายงาน ระบบเติมจากข้อมูลให้",
  ].join("\n"),
  example: {
    request: "รายงานการประชุมคณะกรรมการบริหารครั้งที่ 5/2569 ประธานแจ้งเรื่องระบบสารบรรณอิเล็กทรอนิกส์ ที่ประชุมรับทราบ แล้วพิจารณาจัดซื้อคอมพิวเตอร์ 8 เครื่อง ที่ประชุมเห็นชอบ",
    facts: {
      meetingName: "คณะกรรมการบริหารสำนักงานตัวอย่าง",
      session: "5/2569",
      meetingDate: "วันพฤหัสบดีที่ 23 ตุลาคม 2569",
      place: "ห้องประชุมใหญ่ สำนักงานตัวอย่าง",
      attendees: "นายตัวอย่าง ทดสอบระบบ ผู้อำนวยการ ประธานกรรมการ\nนางตัวอย่าง สอง หัวหน้ากองคลัง กรรมการ\nนางสาวตัวอย่าง สาม หัวหน้างานสารบรรณ กรรมการและเลขานุการ",
      startTime: "09.30",
      endTime: "11.00",
      recorder: "นางสาวตัวอย่าง สาม",
    },
    wording: {
      agenda: [
        {
          title: "เรื่องที่ประธานแจ้งให้ที่ประชุมทราบ",
          discussion: ["ประธานแจ้งว่าสำนักงานตัวอย่างนำระบบสารบรรณอิเล็กทรอนิกส์มาใช้ตั้งแต่เดือนตุลาคม 2569 และขอให้ทุกกองใช้ระบบในการรับส่งหนังสือ"],
          resolution: "ที่ประชุมรับทราบ",
        },
        {
          title: "เรื่องเพื่อพิจารณา การจัดซื้อเครื่องคอมพิวเตอร์ทดแทน",
          discussion: ["หัวหน้ากองคลังเสนอให้จัดซื้อเครื่องคอมพิวเตอร์ทดแทนเครื่องที่ชำรุด จำนวน 8 เครื่อง วงเงิน 200,000 บาท จากงบประมาณประจำปี 2570"],
          resolution: "ที่ประชุมเห็นชอบให้ดำเนินการจัดซื้อตามที่เสนอ",
        },
      ],
    },
  },

  assemble(w, facts, ctx) {
    return {
      ...w,
      meetingName: facts.meetingName?.trim() || placeholder("ชื่อคณะที่ประชุม"),
      session: facts.session?.trim() || `${placeholder("ครั้งที่")}/${yearBE(ctx)}`,
      when: facts.meetingDate?.trim() || `วันที่ ${dateOf(facts, ctx)}`,
      place: facts.place?.trim() || placeholder("สถานที่ประชุม"),
      attendees: lines(facts.attendees),
      absentees: lines(facts.absentees),
      others: lines(facts.others),
      start: time(facts.startTime),
      end: time(facts.endTime),
      recorder: facts.recorder?.trim() || placeholder("ผู้จดรายงานการประชุม"),
    };
  },

  rules: [
    (d): Finding[] => {
      const out: Finding[] = [];
      if (!d.agenda.length) out.push({ level: "error", rule: "MIN_AGENDA", message: "ต้องมีข้อความการประชุมตามระเบียบวาระ", where: "wording.agenda", ref: REF("๙") });
      if (!d.attendees.length) out.push({ level: "warning", rule: "MIN_ATTENDEES", message: "ยังไม่มีรายชื่อผู้มาประชุม", where: "facts.attendees", ref: REF("๕") });
      return out;
    },
  ],

  layout(d, ctx) {
    const list = (heading: string, items: string[]): Block[] =>
      items.length
        ? [
            para([{ text: heading, bold: true }], { spaceBeforePt: SPEC.paraGapPt }),
            ...items.map((x, i) => para(`${i + 1}. ${x}`, { indentLeftCm: SPEC.firstLineCm, hangingCm: 0.75 })),
          ]
        : [];
    const blocks: Block[] = [
      centered(`รายงานการประชุม${d.meetingName}`, { bold: true }),
      centered(`ครั้งที่ ${d.session}`),
      centered(`เมื่อ${d.when}`),
      centered(`ณ ${d.place}`),
      separator(),
      ...(d.attendees.length ? list("ผู้มาประชุม", d.attendees) : [para([{ text: "ผู้มาประชุม", bold: true }]), para(`1. ${placeholder("รายชื่อผู้มาประชุม")}`, { indentLeftCm: SPEC.firstLineCm })]),
      ...list("ผู้ไม่มาประชุม", d.absentees),
      ...list("ผู้เข้าร่วมประชุม", d.others),
      para(`เริ่มประชุมเวลา ${d.start}`, { spaceBeforePt: SPEC.closingGapPt }),
      ...d.agenda.flatMap((a, i): Block[] => [
        para([{ text: `ระเบียบวาระที่ ${i + 1}  ${a.title}`, bold: true }], { spaceBeforePt: SPEC.closingGapPt, keepWithNext: true }),
        ...bodyParas(a.discussion),
        para([{ text: "มติที่ประชุม", bold: true }, { text: `  ${a.resolution}` }], { firstLineCm: SPEC.firstLineCm, spaceBeforePt: SPEC.paraGapPt }),
      ]),
      para(`เลิกประชุมเวลา ${d.end}`, { spaceBeforePt: SPEC.closingGapPt, keepWithNext: true }),
      blank(3, true),
      para(`(${d.recorder.replace(/^\(|\)$/g, "")})`, { align: "center", indentLeftCm: SPEC.signColCm, keepWithNext: true }),
      para("ผู้จดรายงานการประชุม", { align: "center", indentLeftCm: SPEC.signColCm }),
    ];
    return docIR(`รายงานการประชุม — ${d.meetingName}`, ctx, blocks);
  },
};
