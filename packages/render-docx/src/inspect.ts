/**
 * ตรวจไฟล์ .docx ที่ผู้ใช้เขียนเองใน Word (ไม่ผ่าน AI) — อ่านหน้ากระดาษ ฟอนต์ ขนาด ตราครุฑ และข้อความ
 * ใช้ regex อ่าน XML เพื่อให้รันได้ทั้งใน Node และเบราว์เซอร์โดยไม่ต้องมี DOMParser
 */
import JSZip from "jszip";
import { genericRules, marginsFor, type Finding, type Margins, type PageStandard, type TemplatePack } from "@thdocs/core";

export interface InspectOptions {
  /** มาตรฐานหน้ากระดาษของชุดแม่แบบ (ไม่ใส่ = ไม่ตรวจขอบ) */
  page?: PageStandard;
  /** ฟอนต์ที่ยอมรับ (ตัวแรก = ตัวที่แนะนำ) */
  fonts?: string[];
  bodyPt?: number;
  /** หนังสือราชการ: ควรมีตราครุฑ */
  expectEmblem?: boolean;
  /** แหล่งอ้างอิงที่แสดงในผลตรวจ */
  ref?: string;
}

export interface DocxFacts {
  pageWidthCm?: number;
  pageHeightCm?: number;
  margins?: Partial<Margins>;
  /** ฟอนต์ → จำนวนตัวอักษรที่ใช้ */
  fonts: Record<string, number>;
  /** ขนาดตัวอักษร (pt) → จำนวนตัวอักษร */
  sizes: Record<string, number>;
  images: { widthCm: number; heightCm: number }[];
  text: string[];
}

const TWIP_CM = 1 / 567;
const EMU_CM = 1 / 360000;
const entity = (s: string) => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");
const attr = (tag: string, name: string) => tag.match(new RegExp(`${name}="([^"]*)"`))?.[1];
const bump = (m: Record<string, number>, k: string, n: number) => void (m[k] = (m[k] ?? 0) + n);

export async function readDocx(data: ArrayBuffer | Uint8Array): Promise<DocxFacts> {
  const zip = await JSZip.loadAsync(data);
  const docFile = zip.file("word/document.xml");
  if (!docFile) throw new Error("ไม่ใช่ไฟล์ .docx (ไม่พบ word/document.xml)");
  const xml = await docFile.async("string");
  const styles = (await zip.file("word/styles.xml")?.async("string")) ?? "";

  const style = readStyles(styles);

  const facts: DocxFacts = { fonts: {}, sizes: {}, images: [], text: [] };

  // หน้ากระดาษ: sectPr ตัวสุดท้าย = ส่วนสุดท้ายของเอกสาร
  const sect = [...xml.matchAll(/<w:sectPr[\s\S]*?<\/w:sectPr>/g)].pop()?.[0];
  if (sect) {
    const sz = sect.match(/<w:pgSz[^>]*>/)?.[0];
    const mar = sect.match(/<w:pgMar[^>]*>/)?.[0];
    if (sz) {
      facts.pageWidthCm = Number(attr(sz, "w:w")) * TWIP_CM;
      facts.pageHeightCm = Number(attr(sz, "w:h")) * TWIP_CM;
    }
    if (mar) {
      const cm = (n: string) => {
        const v = Number(attr(mar, n));
        return Number.isFinite(v) ? v * TWIP_CM : undefined;
      };
      facts.margins = { topCm: cm("w:top"), bottomCm: cm("w:bottom"), leftCm: cm("w:left"), rightCm: cm("w:right"), headerCm: cm("w:header") };
    }
  }

  for (const p of xml.match(/<w:p[ >][\s\S]*?<\/w:p>/g) ?? []) {
    let line = "";
    for (const r of p.match(/<w:r[ >][\s\S]*?<\/w:r>/g) ?? []) {
      const t = [...r.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>|<w:tab\/>/g)].map((m) => (m[1] === undefined ? "\t" : entity(m[1]))).join("");
      line += t;
      if (!t.trim()) continue;
      const { font, sz } = style.resolve(p, r);
      bump(facts.fonts, font, t.length);
      bump(facts.sizes, String(sz / 2), t.length);
    }
    for (const d of p.match(/<wp:extent[^>]*>/g) ?? []) {
      facts.images.push({ widthCm: Number(attr(d, "cx")) * EMU_CM, heightCm: Number(attr(d, "cy")) * EMU_CM });
    }
    const clean = line.replace(/[​⁠﻿]/g, "").replace(/ /g, " ");
    if (clean.trim()) facts.text.push(clean);
  }
  return facts;
}

interface RunProps { font?: string; sz?: number }
interface StyleDef extends RunProps { basedOn?: string; isDefault?: boolean }

/** ฟอนต์/ขนาดจาก <w:rPr> — ตัวอักษรไทยใช้ฟอนต์และขนาดชุด complex script (cs) ก่อน */
function runProps(rPr: string): RunProps {
  const fonts = rPr.match(/<w:rFonts[^>]*>/)?.[0] ?? "";
  const font = attr(fonts, "w:cs") ?? attr(fonts, "w:ascii") ?? attr(fonts, "w:hAnsi") ?? (attr(fonts, "w:csTheme") ?? attr(fonts, "w:asciiTheme") ? "ฟอนต์ตามธีมของ Word" : undefined);
  const szCs = Number(attr(rPr.match(/<w:szCs [^>]*>/)?.[0] ?? "", "w:val"));
  const sz = Number(attr(rPr.match(/<w:sz [^>]*>/)?.[0] ?? "", "w:val"));
  return { ...(font ? { font } : {}), ...(szCs || sz ? { sz: szCs || sz } : {}) };
}

/** อ่าน styles.xml: ค่าตั้งต้นเอกสาร → สไตล์ Normal → สไตล์ย่อหน้า (ตามสาย basedOn) → ตัวอักษรของ run */
function readStyles(xml: string) {
  const defaults = runProps(xml.match(/<w:rPrDefault>[\s\S]*?<\/w:rPrDefault>/)?.[0] ?? "");
  const defs = new Map<string, StyleDef>();
  let normal: string | undefined;
  for (const m of xml.matchAll(/<w:style\s[^>]*>[\s\S]*?<\/w:style>/g)) {
    const block = m[0];
    const head = block.match(/<w:style\s[^>]*>/)![0];
    const id = attr(head, "w:styleId");
    if (!id) continue;
    const basedOn = attr(block.match(/<w:basedOn [^>]*>/)?.[0] ?? "", "w:val");
    const isDefault = attr(head, "w:default") === "1" && attr(head, "w:type") === "paragraph";
    if (isDefault) normal = id;
    defs.set(id, { ...runProps(block.match(/<w:rPr>[\s\S]*?<\/w:rPr>/)?.[0] ?? ""), ...(basedOn ? { basedOn } : {}), isDefault });
  }
  const chain = (id: string | undefined): RunProps => {
    const seen = new Set<string>();
    let out: RunProps = {};
    for (let cur = id; cur && !seen.has(cur) && defs.has(cur); cur = defs.get(cur)!.basedOn) {
      seen.add(cur);
      const d = defs.get(cur)!;
      out = { ...(d.font ? { font: d.font } : {}), ...(d.sz ? { sz: d.sz } : {}), ...out };
    }
    return out;
  };
  return {
    resolve(p: string, r: string): { font: string; sz: number } {
      const pStyle = attr(p.match(/<w:pStyle [^>]*>/)?.[0] ?? "", "w:val");
      const rStyle = attr(r.match(/<w:rStyle [^>]*>/)?.[0] ?? "", "w:val");
      const direct = runProps(r.match(/<w:rPr>[\s\S]*?<\/w:rPr>/)?.[0] ?? "");
      const layers = [direct, chain(rStyle), chain(pStyle ?? normal), chain(normal), defaults];
      return { font: layers.find((l) => l.font)?.font ?? "(ไม่ระบุ)", sz: layers.find((l) => l.sz)?.sz ?? 20 };
    },
  };
}

const norm = (f: string) => f.replace(/\s+/g, "").toLowerCase();
const top = (m: Record<string, number>) => Object.entries(m).sort((a, b) => b[1] - a[1])[0]?.[0];

export function inspectFacts(facts: DocxFacts, opt: InspectOptions = {}): Finding[] {
  const out: Finding[] = [];
  const add = (level: Finding["level"], rule: string, message: string, where?: string) =>
    out.push({ level, rule, message, ...(where ? { where } : {}), ...(opt.ref ? { ref: opt.ref } : {}) });

  if (facts.pageWidthCm && facts.pageHeightCm) {
    if (Math.abs(facts.pageWidthCm - 21) > 0.1 || Math.abs(facts.pageHeightCm - 29.7) > 0.1) {
      add("error", "DOCX_PAGE_SIZE", `ขนาดกระดาษ ${facts.pageWidthCm.toFixed(1)}×${facts.pageHeightCm.toFixed(1)} ซม. ไม่ใช่ A4 (21×29.7) — เปลี่ยนที่ เค้าโครง > ขนาด`, "หน้ากระดาษ");
    }
  }

  if (opt.page && facts.margins) {
    const label: Record<keyof Margins, string> = { topCm: "ขอบบน", bottomCm: "ขอบล่าง", leftCm: "ขอบซ้าย", rightCm: "ขอบขวา", headerCm: "ระยะหัวกระดาษ" };
    const want = marginsFor("", opt.page, { margins: {} } as never);
    for (const k of Object.keys(label) as (keyof Margins)[]) {
      const have = facts.margins[k];
      if (have === undefined || Math.abs(have - want[k]) <= 0.05) continue;
      const isStd = opt.page.standard.includes(k);
      add(isStd ? "warning" : "info", "DOCX_MARGIN", `${label[k]} ${have.toFixed(2)} ซม.${isStd ? ` ไม่ตรงมาตรฐาน (${want[k]} ซม.)` : ` (ค่าแนะนำ ${want[k]} ซม. — แต่ละหน่วยงานกำหนดเองได้)`}`, "หน้ากระดาษ");
    }
  }

  if (opt.fonts?.length) {
    const ok = opt.fonts.map(norm);
    const bad = Object.entries(facts.fonts).filter(([f]) => !ok.some((o) => norm(f).includes(o) || o.includes(norm(f))));
    const total = Object.values(facts.fonts).reduce((a, b) => a + b, 0) || 1;
    const badN = bad.reduce((a, [, n]) => a + n, 0);
    if (badN / total > 0.05) {
      add("warning", "DOCX_FONT", `ใช้ฟอนต์ ${bad.map(([f]) => f).join(", ")} (${Math.round((badN / total) * 100)}% ของข้อความ) — ควรใช้ ${opt.fonts[0]}`, "ฟอนต์");
    }
  }

  if (opt.bodyPt) {
    const main = Number(top(facts.sizes));
    if (main && Math.abs(main - opt.bodyPt) > 0.1) add("warning", "DOCX_SIZE", `ตัวอักษรส่วนใหญ่ขนาด ${main} pt — เนื้อหาควรเป็น ${opt.bodyPt} pt`, "ขนาดตัวอักษร");
  }

  if (opt.expectEmblem) {
    const big = facts.images.filter((i) => i.heightCm > 0.5); // ขนาดตราครุฑวัดที่ความสูง
    if (!big.length) add("warning", "DOCX_EMBLEM", "ไม่พบตราครุฑ — หนังสือภายนอกใช้ตรา 3 ซม. (หนังสือประทับตรา 1.5 ซม.)", "หัวหนังสือ");
    else if (big.every((i) => Math.abs(i.heightCm - 3) > 0.3 && Math.abs(i.heightCm - 1.5) > 0.3)) {
      add("warning", "DOCX_EMBLEM_SIZE", `ตราครุฑสูง ${big[0]!.heightCm.toFixed(1)} ซม. — ควรเป็น 3 ซม. (หนังสือประทับตรา 1.5 ซม.)`, "หัวหนังสือ");
    }
  }

  const all = facts.text.join("\n");
  const arabic = all.replace(/\d+(?:[-/.]\d+)+|https?:\/\/\S+|\S+@\S+|[A-Za-z]+\d+/g, "");
  if (/[๐-๙]/.test(all) && /[0-9]/.test(arabic)) {
    add("info", "DOCX_DIGITS", "ใช้เลขไทยปนเลขอารบิก — หนังสือราชการใช้เลขไทยทั้งฉบับ (ยกเว้นที่อยู่เว็บ/อีเมล)", "ตัวเลข");
  }
  if (!facts.text.length) add("error", "DOCX_EMPTY", "ไม่พบข้อความในเอกสาร");

  const generic = genericRules(Object.fromEntries(facts.text.map((t, i) => [`ย่อหน้า ${i + 1}`, t])));
  out.push(...generic.map((f) => ({ ...f, ...(opt.ref ? { ref: opt.ref } : {}) })));
  return out;
}

export async function inspectDocx(data: ArrayBuffer | Uint8Array, opt: InspectOptions = {}): Promise<{ facts: DocxFacts; findings: Finding[] }> {
  const facts = await readDocx(data);
  return { facts, findings: inspectFacts(facts, opt) };
}

/** ตัวเลือกตรวจที่ได้จากชุดแม่แบบ */
export function inspectOptionsFor(pack: TemplatePack): InspectOptions {
  return {
    ...(pack.page ? { page: pack.page } : {}),
    ...(pack.docx ? { fonts: pack.docx.fonts, ...(pack.docx.bodyPt ? { bodyPt: pack.docx.bodyPt } : {}), expectEmblem: !!pack.docx.emblem } : {}),
    ref: pack.name,
  };
}
