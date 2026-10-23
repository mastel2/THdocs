/**
 * ส่วนกลางของเอกสารระบบคุณภาพ — การควบคุมเอกสาร (ตามหลัก ISO 9001 ข้อ 7.5 เรื่องสารสนเทศที่เป็นเอกสาร)
 * ระบบนี้ให้เฉพาะ "โครงเอกสาร" ที่ใช้ทั่วไป ไม่มีข้อความของตัวมาตรฐาน (ตัวมาตรฐานมีลิขสิทธิ์)
 *
 * ทุกเอกสารมี: ตารางควบคุมเอกสารที่หัวกระดาษทุกหน้า (เลขที่ ฉบับแก้ไข วันที่มีผล หน้า x/y)
 *             ตารางลงนามจัดทำ/ทบทวน/อนุมัติ และบันทึกประวัติการแก้ไข
 */
import {
  cell,
  marginsFor,
  para,
  placeholder,
  thaiDate,
  type Block,
  type Context,
  type DocIR,
  type FactSpec,
  type Facts,
  type Finding,
  type PageSetup,
  type PageStandard,
  type Table,
} from "@thdocs/core";

export const PACK = "iso";

export const SPEC = {
  font: "TH SarabunPSK",
  bodyPt: 16,
  textWidthCm: 16.5, // 21 - 2.5 - 2
  indentCm: 0.75,
  gapPt: 6,
  shade: "E7ECF5",
} as const;

/** เอกสารระบบคุณภาพของเอกชนไม่มีระยะขอบบังคับ — ตั้งต้นใกล้ค่ามาตรฐานของ Word หน่วยงานปรับได้ทุกช่อง */
export const PAGE: PageStandard = {
  margins: { topCm: 2.5, bottomCm: 2, leftCm: 2.5, rightCm: 2, headerCm: 1.25 },
  standard: [],
  note: "เอกสารระบบคุณภาพไม่มีระยะขอบบังคับ — ใช้ตามแบบเอกสารขององค์กร",
};

export function pageSetup(ctx: Context): PageSetup {
  const m = marginsFor(PACK, PAGE, ctx.profile);
  return {
    widthCm: 21,
    heightCm: 29.7,
    marginTopCm: m.topCm,
    marginBottomCm: m.bottomCm,
    marginLeftCm: m.leftCm,
    marginRightCm: m.rightCm,
    headerCm: m.headerCm,
    font: SPEC.font,
    sizePt: SPEC.bodyPt,
    // เอกสารระบบคุณภาพของเอกชนส่วนใหญ่ใช้เลขอารบิก — เปลี่ยนได้ด้วย options.thaiDigits
    thaiDigits: ctx.options.thaiDigits ?? false,
    pageNumbers: false,
  };
}

/** ข้อมูลควบคุมเอกสาร — ไม่บังคับ ไม่มีระบบใส่ [ระบุ] */
export const CONTROL_FACTS: FactSpec[] = [
  { key: "docNo", question: "รหัสเอกสาร", required: false, example: "QP-HR-01" },
  { key: "revision", question: "ฉบับแก้ไขที่ (ไม่ระบุ = 00)", required: false, example: "00" },
  { key: "effectiveDate", question: "วันที่มีผลบังคับใช้ (ไม่ระบุ = วันนี้)", required: false },
  { key: "preparedBy", question: "ผู้จัดทำ (ชื่อ / ตำแหน่ง)", required: false, example: "นางสาวตัวอย่าง สาม / เจ้าหน้าที่ควบคุมเอกสาร" },
  { key: "reviewedBy", question: "ผู้ทบทวน (ชื่อ / ตำแหน่ง)", required: false },
  { key: "approvedBy", question: "ผู้อนุมัติ (ชื่อ / ตำแหน่ง)", required: false },
  { key: "revisionHistory", question: "ประวัติการแก้ไข (บรรทัดละครั้ง: ฉบับ | วันที่ | รายละเอียด | ผู้แก้ไข)", required: false },
];

export interface Person {
  name: string;
  position: string;
}

export interface Control {
  org: string;
  typeLabel: string;
  docNo: string;
  revision: string;
  effectiveDate: string;
  prepared: Person;
  reviewed: Person;
  approved: Person;
  history: [string, string, string, string][];
}

function person(raw: string | null | undefined, role: string): Person {
  const [name = "", position = ""] = (raw ?? "").split("/").map((s) => s.trim());
  return { name: name || placeholder(`ชื่อ${role}`), position: position || placeholder(`ตำแหน่ง${role}`) };
}

export function controlOf(facts: Facts, ctx: Context, typeLabel: string, docNoHint: string): Control {
  const revision = facts.revision?.trim() || "00";
  const effectiveDate = facts.effectiveDate?.trim() || thaiDate(ctx.options.date ?? new Date());
  const prepared = person(facts.preparedBy, "ผู้จัดทำ");
  const history = (facts.revisionHistory ?? "")
    .split("\n")
    .map((l) => l.split("|").map((s) => s.trim()))
    .filter((r) => r.some(Boolean))
    .map((r) => [r[0] ?? "", r[1] ?? "", r[2] ?? "", r[3] ?? ""] as [string, string, string, string]);
  return {
    org: ctx.profile.orgName,
    typeLabel,
    docNo: facts.docNo?.trim() || placeholder(`รหัสเอกสาร เช่น ${docNoHint}`),
    revision,
    effectiveDate,
    prepared,
    reviewed: person(facts.reviewedBy, "ผู้ทบทวน"),
    approved: person(facts.approvedBy, "ผู้อนุมัติ"),
    history: history.length
      ? history
      : [[revision, effectiveDate, revision === "00" ? "จัดทำครั้งแรก" : placeholder("รายละเอียดการแก้ไข"), prepared.name]],
  };
}

/** ตารางควบคุมเอกสาร — อยู่ที่หัวกระดาษ จึงแสดงซ้ำทุกหน้า */
export function controlHeader(c: Control, title: string): Block[] {
  const t: Table = {
    kind: "table",
    columnsCm: [11, 5.5],
    rows: [
      { cells: [cell(c.org, { bold: true }), cell(`รหัสเอกสาร: ${c.docNo}`)] },
      {
        cells: [
          // ไม่เติมชนิดเอกสารซ้ำ ถ้าชื่อเรื่องขึ้นต้นด้วยชนิดเอกสารอยู่แล้ว
          cell(title.startsWith(c.typeLabel) ? [{ text: title, bold: true }] : [{ text: `${c.typeLabel}: `, bold: true }, { text: title, bold: true }]),
          cell(`ฉบับแก้ไขที่: ${c.revision}`),
        ],
      },
      {
        cells: [
          cell(`วันที่มีผลบังคับใช้: ${c.effectiveDate}`),
          cell([{ text: "หน้า " }, { text: "", field: "page" }, { text: " / " }, { text: "", field: "pages" }]),
        ],
      },
    ],
  };
  return [t];
}

/** หัวข้อหลัก "1. วัตถุประสงค์" แล้วตามด้วยเนื้อหาเยื้อง */
export function section(no: number, heading: string, body: Block[]): Block[] {
  return [para([{ text: `${no}. ${heading}`, bold: true }], { spaceBeforePt: SPEC.gapPt * 2, keepWithNext: true }), ...body];
}

export const paras = (lines: string[]): Block[] =>
  lines.map((t) => para(t, { indentLeftCm: SPEC.indentCm, align: "thaiDistribute", spaceBeforePt: 2 }));

export const bullets = (lines: string[], none = "ไม่มี"): Block[] =>
  (lines.length ? lines : [none]).map((t, i) =>
    para(lines.length ? `${i + 1}) ${t}` : t, { indentLeftCm: SPEC.indentCm + 0.6, hangingCm: 0.6, spaceBeforePt: 2 }),
  );

/** ตารางมีหัวคอลัมน์สีพื้น และหัวซ้ำเมื่อขึ้นหน้าใหม่ */
export function grid(columnsCm: number[], head: string[], rows: string[][], center: number[] = []): Table {
  return {
    kind: "table",
    columnsCm,
    spaceBeforePt: 4,
    rows: [
      { header: true, cells: head.map((h) => cell(h, { bold: true, align: "center", shade: SPEC.shade })) },
      ...rows.map((r) => ({ cells: r.map((v, i) => cell(v, { vAlign: "top", ...(center.includes(i) ? { align: "center" as const } : {}) })) })),
    ],
  };
}

/** ตารางข้อมูลทั่วไปสองคอลัมน์ (หัวข้อสีพื้น | ค่า) เช่น หน่วยงานที่ตรวจ วันที่ ผู้ตรวจ */
export function infoTable(rows: [string, string][]): Table {
  return {
    kind: "table",
    columnsCm: [4.5, 12],
    spaceBeforePt: 4,
    rows: rows.map(([k, v]) => ({ cells: [cell(k, { bold: true, shade: SPEC.shade }), cell(v)] })),
  };
}

/** ช่องลงนามตามบทบาท เช่น ผู้ตรวจ / ผู้รับการตรวจ */
export function signTable(roles: [string, string][]): Table {
  const w = SPEC.textWidthCm / roles.length;
  return {
    kind: "table",
    columnsCm: roles.map(() => w),
    spaceBeforePt: 8,
    keepTogether: true,
    rows: [
      { cells: roles.map(([role]) => cell(role, { bold: true, align: "center", shade: SPEC.shade })) },
      { cells: roles.map(([, name]) => cell(`\n\n(${name})\nวันที่ ......../......../........`, { align: "center", vAlign: "top" })) },
    ],
  };
}

/** ตารางลงนามจัดทำ/ทบทวน/อนุมัติ + ประวัติการแก้ไข — ปิดท้ายทุกเอกสาร */
export function approvalAndHistory(c: Control, startNo: number): Block[] {
  const sign = (p: Person) => cell(`\n\n(${p.name})\n${p.position}\nวันที่ ......../......../........`, { align: "center", vAlign: "top" });
  return [
    ...section(startNo, "การอนุมัติเอกสาร", [
      {
        kind: "table",
        columnsCm: [5.5, 5.5, 5.5],
        spaceBeforePt: 4,
        keepTogether: true,
        rows: [
          { cells: ["จัดทำโดย", "ทบทวนโดย", "อนุมัติโดย"].map((h) => cell(h, { bold: true, align: "center", shade: SPEC.shade })) },
          { cells: [sign(c.prepared), sign(c.reviewed), sign(c.approved)] },
        ],
      },
    ]),
    ...section(startNo + 1, "บันทึกการแก้ไขเอกสาร", [grid([2.3, 3.2, 7.5, 3.5], ["ฉบับแก้ไขที่", "วันที่มีผล", "รายละเอียดการแก้ไข", "ผู้แก้ไข"], c.history, [0, 1])]),
  ];
}

export function isoIR(title: string, ctx: Context, c: Control, blocks: Block[]): DocIR {
  return { title: `${c.docNo} ${title}`, page: pageSetup(ctx), header: controlHeader(c, title), blocks };
}

export function controlRules(c: Control): Finding[] {
  const out: Finding[] = [];
  if (!/^[0-9]{1,3}$/.test(c.revision)) {
    out.push({ level: "info", rule: "ISO_REVISION", message: "ฉบับแก้ไขที่ควรเป็นตัวเลขเรียงลำดับ เช่น 00, 01, 02", where: "facts.revision", ref: "ISO 9001 ข้อ 7.5.2 (การชี้บ่งเอกสาร)" });
  }
  if (c.history.length && c.history.at(-1)![0] !== c.revision) {
    out.push({ level: "warning", rule: "ISO_HISTORY", message: "แถวล่าสุดของบันทึกการแก้ไขไม่ตรงกับฉบับแก้ไขปัจจุบัน", where: "facts.revisionHistory", ref: "ISO 9001 ข้อ 7.5.3 (การควบคุมการเปลี่ยนแปลง)" });
  }
  return out;
}
