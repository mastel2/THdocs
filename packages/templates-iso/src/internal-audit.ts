/** รายงานการตรวจติดตามภายใน (Internal Audit Report) — ผลการตรวจเทียบกับเกณฑ์ พร้อมหลักฐาน */
import { placeholder, thaiDate, type DocTypeDef, type Finding } from "@thdocs/core";
import { z } from "zod";
import { CONTROL_FACTS, PACK, controlOf, controlRules, grid, infoTable, isoIR, paras, section, signTable, type Control } from "./common";

export const FINDING_TYPES = ["ข้อบกพร่องหลัก", "ข้อบกพร่องย่อย", "ข้อสังเกต", "จุดเด่น"] as const;

export const InternalAuditWording = z.object({
  title: z.string().describe("ชื่อเรื่องสั้น ๆ ไม่ต้องขึ้นต้นด้วย 'รายงานการตรวจติดตามภายใน' เช่น 'ฝ่ายจัดซื้อ ประจำปี 2569'"),
  scope: z.array(z.string()).describe("ขอบเขตการตรวจ: กระบวนการ/พื้นที่ที่ตรวจ"),
  findings: z
    .array(
      z.object({
        type: z.enum(FINDING_TYPES).describe("ประเภท: ข้อบกพร่องหลัก = ระบบล้มเหลว/ไม่มีการปฏิบัติ, ข้อบกพร่องย่อย = ไม่สอดคล้องเป็นครั้งคราว, ข้อสังเกต = โอกาสปรับปรุง, จุดเด่น = สิ่งที่ทำได้ดี"),
        requirement: z.string().describe("ข้อกำหนด/เอกสารที่ใช้เทียบ เช่น 'QP-PU-01 ขั้นตอนที่ 3' — ไม่ทราบให้ใส่ [ระบุ: ข้อกำหนด]"),
        finding: z.string().describe("สิ่งที่พบ"),
        evidence: z.string().describe("หลักฐานที่เห็น เช่น เลขที่เอกสาร วันที่ บันทึก"),
      }),
    )
    .describe("ผลการตรวจทีละประเด็น"),
  summary: z.array(z.string()).describe("สรุปภาพรวมของผลการตรวจ"),
});
export type InternalAuditWording = z.infer<typeof InternalAuditWording>;
export type InternalAudit = InternalAuditWording & {
  control: Control;
  info: [string, string][];
  counts: Record<(typeof FINDING_TYPES)[number], number>;
  leadAuditor: string;
  auditeeRep: string;
};

export const internalAudit: DocTypeDef<InternalAuditWording, InternalAudit> = {
  id: "iso_internal_audit",
  pack: PACK,
  name: "รายงานการตรวจติดตามภายใน (Internal Audit)",
  description: "บันทึกผลการตรวจติดตามภายในเทียบกับข้อกำหนด พร้อมหลักฐาน และสรุปจำนวนข้อบกพร่อง",
  facts: [
    { key: "area", question: "หน่วยงาน/กระบวนการที่ถูกตรวจ", required: true, example: "ฝ่ายจัดซื้อ" },
    { key: "observations", question: "สิ่งที่พบระหว่างตรวจ (แต่ละประเด็นพร้อมหลักฐาน)", required: true },
    { key: "criteria", question: "เกณฑ์ที่ใช้ตรวจ", required: false, example: "ISO 9001:2015, QP-PU-01" },
    { key: "auditDate", question: "วันที่ตรวจ (ไม่ระบุ = วันนี้)", required: false },
    { key: "auditors", question: "ผู้ตรวจ (คนแรก = หัวหน้าผู้ตรวจ คั่นด้วย ,)", required: false },
    { key: "auditees", question: "ผู้รับการตรวจ (คนแรก = ผู้แทนหน่วยงาน คั่นด้วย ,)", required: false },
    ...CONTROL_FACTS.filter((f) => !["reviewedBy", "revisionHistory"].includes(f.key)),
  ],
  wordingSchema: InternalAuditWording,
  guidance: [
    "เขียนแต่ละประเด็นให้เป็นข้อเท็จจริงที่ตรวจสอบได้: สิ่งที่พบ + หลักฐาน (เลขที่เอกสาร วันที่ ตัวอย่างที่สุ่ม)",
    "จัดประเภทตามความรุนแรงที่ผู้ใช้บอก ถ้าไม่ชัดให้ใช้ 'ข้อสังเกต' และอย่ายกระดับเอง",
    "ใช้เฉพาะสิ่งที่ผู้ใช้ให้มา ห้ามแต่งหลักฐานหรือเลขเอกสาร ใช้ [ระบุ: ...] แทน",
    "ห้ามคัดลอกข้อความของมาตรฐาน ISO — อ้างได้เฉพาะเลขข้อ",
  ].join("\n"),
  example: {
    request: "ตรวจฝ่ายจัดซื้อ พบใบสั่งซื้อ PO-2569-045 ไม่มีตารางเปรียบเทียบราคา 3 ราย และพบว่าทะเบียนผู้ขายไม่ได้ประเมินประจำปี 2568 แต่การจัดเก็บเอกสารเป็นระเบียบดี",
    facts: {
      area: "ฝ่ายจัดซื้อ",
      criteria: "ISO 9001:2015, QP-PU-01 การจัดซื้อ",
      docNo: "FM-IA-03",
      auditors: "นางตัวอย่าง สอง, นายตัวอย่าง สี่",
      auditees: "นางสาวตัวอย่าง สาม",
    },
    wording: {
      title: "ฝ่ายจัดซื้อ ประจำปี 2569",
      scope: ["กระบวนการจัดซื้อและการประเมินผู้ขาย ตั้งแต่ใบขอซื้อจนถึงการตรวจรับ"],
      findings: [
        { type: "ข้อบกพร่องย่อย", requirement: "QP-PU-01 ขั้นตอนที่ 3", finding: "การจัดซื้อบางรายการไม่มีการเปรียบเทียบราคาจากผู้ขาย 3 ราย", evidence: "ใบสั่งซื้อ PO-2569-045 ไม่มีตารางเปรียบเทียบราคาแนบ" },
        { type: "ข้อสังเกต", requirement: "ISO 9001:2015 ข้อ 8.4.1", finding: "ยังไม่ได้ประเมินผู้ขายประจำปี 2568", evidence: "ทะเบียนผู้ขายไม่มีผลการประเมินปี 2568" },
        { type: "จุดเด่น", requirement: "-", finding: "การจัดเก็บเอกสารจัดซื้อเป็นระเบียบ ค้นหาได้รวดเร็ว", evidence: "แฟ้มจัดซื้อแยกตามเดือนและเลขที่ใบสั่งซื้อ" },
      ],
      summary: ["ฝ่ายจัดซื้อปฏิบัติตามขั้นตอนเป็นส่วนใหญ่ พบข้อบกพร่องย่อยเรื่องการเปรียบเทียบราคา ซึ่งต้องออกใบขอให้ปฏิบัติการแก้ไข"],
    },
  },

  assemble(w, facts, ctx) {
    const auditors = (facts.auditors ?? "").split(",").map((s) => s.trim()).filter(Boolean);
    const auditees = (facts.auditees ?? "").split(",").map((s) => s.trim()).filter(Boolean);
    const counts = Object.fromEntries(FINDING_TYPES.map((t) => [t, w.findings.filter((f) => f.type === t).length])) as InternalAudit["counts"];
    return {
      ...w,
      control: controlOf(facts, ctx, "รายงานการตรวจติดตามภายใน", "FM-IA-01"),
      info: [
        ["หน่วยงานที่ถูกตรวจ", facts.area?.trim() || placeholder("หน่วยงานที่ถูกตรวจ")],
        ["วันที่ตรวจ", facts.auditDate?.trim() || thaiDate(ctx.options.date ?? new Date())],
        ["เกณฑ์ที่ใช้ตรวจ", facts.criteria?.trim() || placeholder("เกณฑ์ เช่น ISO 9001:2015, เลขที่ขั้นตอน")],
        ["ผู้ตรวจ", auditors.join(", ") || placeholder("ผู้ตรวจ")],
        ["ผู้รับการตรวจ", auditees.join(", ") || placeholder("ผู้รับการตรวจ")],
      ],
      counts,
      leadAuditor: auditors[0] ?? placeholder("หัวหน้าผู้ตรวจ"),
      auditeeRep: auditees[0] ?? placeholder("ผู้แทนหน่วยงานที่ถูกตรวจ"),
    };
  },

  rules: [
    (d) => controlRules(d.control).filter((f) => f.rule !== "ISO_HISTORY"),
    (d): Finding[] => {
      const out: Finding[] = [];
      if (!d.findings.length) out.push({ level: "error", rule: "IA_EMPTY", message: "ต้องมีผลการตรวจอย่างน้อยหนึ่งประเด็น", where: "wording.findings" });
      d.findings.forEach((f, i) => {
        if (f.type.startsWith("ข้อบกพร่อง") && (!f.evidence.trim() || /\[ระบุ/.test(f.evidence))) {
          out.push({ level: "warning", rule: "IA_EVIDENCE", message: `ประเด็นที่ ${i + 1} เป็นข้อบกพร่องแต่ยังไม่มีหลักฐาน — ข้อบกพร่องต้องมีหลักฐานที่ตรวจสอบได้`, where: `wording.findings[${i}].evidence` });
        }
      });
      return out;
    },
  ],

  layout(d, ctx) {
    const c = d.counts;
    const blocks = [
      ...section(1, "ข้อมูลการตรวจ", [infoTable(d.info)]),
      ...section(2, "ขอบเขตการตรวจ", paras(d.scope)),
      ...section(3, "ผลการตรวจ", [
        grid(
          [1, 2.8, 3.4, 9.3],
          ["ที่", "ประเภท", "ข้อกำหนด", "สิ่งที่พบ / หลักฐาน"],
          d.findings.map((f, i) => [String(i + 1), f.type, f.requirement, `${f.finding}\nหลักฐาน: ${f.evidence}`]),
          [0],
        ),
        grid([4.125, 4.125, 4.125, 4.125], [...FINDING_TYPES], [FINDING_TYPES.map((t) => String(c[t]))], [0, 1, 2, 3]),
      ]),
      ...section(4, "สรุปผลการตรวจ", paras(d.summary)),
      signTable([
        ["หัวหน้าผู้ตรวจ", d.leadAuditor],
        ["ผู้แทนหน่วยงานที่ถูกตรวจ", d.auditeeRep],
      ]),
    ];
    return isoIR(d.title, ctx, d.control, blocks);
  },
};
