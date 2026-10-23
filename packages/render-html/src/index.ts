/**
 * Document IR → HTML สำหรับพรีวิวและพิมพ์เป็น PDF จากเบราว์เซอร์
 * ใช้หน่วย cm/pt ตรงกับ .docx; การแบ่งหน้าจริงให้ดูจากไฟล์ .docx
 */
import { PLACEHOLDER_RE, keepNumberUnits, toArabicDigits, toThaiDigits, type Align, type Block, type DocIR, type Para, type Run, type Table } from "@thdocs/core";

export interface HtmlOptions {
  /** data URL ของตรา — ไม่มี = กรอบแทนตรา */
  emblemSrc?: string;
  /** ชื่อฟอนต์สำรองเมื่อเครื่องไม่มีฟอนต์ของเอกสาร */
  fallbackFonts?: string;
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

const ALIGN: Record<Align, string> = {
  left: "left",
  center: "center",
  right: "right",
  justify: "justify",
  // เบราว์เซอร์จัดเต็มบรรทัดด้วยการยืดช่องว่างเท่านั้น (ไม่กระจายตัวอักษรแบบ Word) ช่องว่างจึงห่างผิดตา — พรีวิวใช้ชิดซ้าย
  thaiDistribute: "left",
};

export const PAGE_CSS = `
.thd-page{box-sizing:border-box;background:#fff;color:#000;position:relative;line-height:1.15;overflow-wrap:anywhere;
  /* x-height ของ TH SarabunPSK/TH Sarabun New = 0.34 em (วัดจากไฟล์ฟอนต์) — ฟอนต์สำรองถูกย่อ/ขยายให้ขนาดตาเท่ากัน */
  font-size-adjust:0.34}
.thd-page p{margin:0;min-height:1.15em}
.thd-ph{background:#ff0}
.thd-tab{display:inline-block;text-indent:0}
.thd-emblem{display:block;margin:0 auto}
.thd-emblem-box{border:1.5px dashed #999;box-sizing:border-box}
.thd-float{position:absolute;left:0}
.thd-mark-top,.thd-mark-bottom{position:absolute;left:0;right:0;text-align:center}
.thd-mark-left{position:absolute;left:0}
.thd-table{border-collapse:collapse;table-layout:fixed}
.thd-table td{border:1px solid #000;padding:1pt 4pt}
.thd-header{margin-bottom:6pt}
@media print{
  @page{size:A4;margin:0}
  body *{visibility:hidden}
  .thd-page,.thd-page *{visibility:visible}
  .thd-page{position:absolute;left:0;top:0;box-shadow:none!important}
}`;

class Html {
  constructor(private readonly ir: DocIR, private readonly opts: HtmlOptions) {}

  private text(t: string) {
    // ตัวเลขตามค่าของเอกสารทั้งสองทาง — วันที่จาก thaiDate() เป็นเลขไทยเสมอ
    return keepNumberUnits(this.ir.page.thaiDigits ? toThaiDigits(t) : toArabicDigits(t));
  }

  private run(r: Run): string {
    if (r.field) return "1"; // พรีวิวแสดงหน้าเดียว — เลขหน้าจริงอยู่ในไฟล์ .docx
    const style = [
      r.bold ? "font-weight:bold" : "",
      r.sizePt ? `font-size:${r.sizePt}pt` : "",
      r.color ? `color:#${r.color}` : "",
    ].filter(Boolean).join(";");
    const body = this.text(r.text)
      .split(new RegExp(`(${PLACEHOLDER_RE.source})`))
      .map((p, i) => (i % 2 === 1 ? `<mark class="thd-ph">${esc(p)}</mark>` : esc(p)))
      .join("");
    return style ? `<span style="${style}">${body}</span>` : body;
  }

  /** tab stop: ข้อความก่อน tab อยู่ในกล่องกว้างถึงตำแหน่ง tab ถัดไป */
  private runsWithTabs(p: Para): string {
    const groups: Run[][] = [[]];
    for (const r of p.runs) {
      if (r.tabBefore) groups.push([]);
      groups[groups.length - 1]!.push(r);
    }
    if (groups.length === 1) return groups[0]!.map((r) => this.run(r)).join("");
    let lineStart = (p.indentLeftCm ?? 0) - (p.hangingCm ?? 0) + (p.firstLineCm ?? 0);
    return groups
      .map((g, i) => {
        const html = g.map((r) => this.run(r)).join("");
        if (i === groups.length - 1) return html;
        const stop = p.tabs?.[i]?.posCm ?? lineStart + 1.25;
        const w = Math.max(stop - lineStart, 0);
        lineStart = stop;
        return `<span class="thd-tab" style="min-width:${w}cm">${html}</span>`;
      })
      .join("");
  }

  private para(p: Para, leading = ""): string {
    const left = p.indentLeftCm ?? 0;
    const indent = (p.firstLineCm ?? 0) - (p.hangingCm ?? 0);
    const style = [
      `text-align:${ALIGN[p.align ?? "left"]}`,
      left ? `padding-left:${left}cm` : "",
      indent ? `text-indent:${indent}cm` : "",
      p.spaceBeforePt ? `margin-top:${p.spaceBeforePt}pt` : "",
      p.spaceAfterPt ? `margin-bottom:${p.spaceAfterPt}pt` : "",
      leading ? "position:relative" : "",
    ].filter(Boolean).join(";");
    return `<p style="${style}">${leading}${this.runsWithTabs(p)}</p>`;
  }

  private emblem(heightCm: number, cls: string): string {
    const src = this.opts.emblemSrc;
    return src
      ? `<img class="${cls}" src="${esc(src)}" alt="ตรา" style="height:${heightCm}cm">`
      : `<span class="${cls} thd-emblem-box" style="height:${heightCm}cm;width:${heightCm * 0.9}cm;display:block"></span>`;
  }

  private table(t: Table): string {
    const cols = t.columnsCm.map((w) => `<col style="width:${w}cm">`).join("");
    const rows = t.rows
      .map((r) => {
        const cells = r.cells
          .map((c) => {
            const style = [c.shade ? `background:#${c.shade}` : "", `vertical-align:${c.vAlign === "top" ? "top" : "middle"}`].filter(Boolean).join(";");
            return `<td${(c.span ?? 1) > 1 ? ` colspan="${c.span}"` : ""} style="${style}">${c.paras.map((p) => this.para(p)).join("")}</td>`;
          })
          .join("");
        return `<tr>${cells}</tr>`;
      })
      .join("");
    const width = t.columnsCm.reduce((a, b) => a + b, 0);
    return `<table class="thd-table" style="width:${width}cm${t.spaceBeforePt ? `;margin-top:${t.spaceBeforePt}pt` : ""}"><colgroup>${cols}</colgroup>${rows}</table>`;
  }

  private blocks(blocks: Block[]): string {
    let pending = "";
    const out: string[] = [];
    for (const b of blocks) {
      if (b.kind === "emblem") {
        if (b.placement === "center") out.push(`<div>${this.emblem(b.heightCm, "thd-emblem")}</div>`);
        else pending = `<span class="thd-float" style="top:-0.2cm">${this.emblem(b.heightCm, "")}</span>`;
      } else if (b.kind === "blank") {
        out.push("<p>&nbsp;</p>".repeat(b.lines));
      } else if (b.kind === "rule") {
        out.push(`<div style="width:${b.widthCm}cm;margin:${b.spaceBeforePt ?? 0}pt auto ${b.spaceAfterPt ?? 6}pt;border-bottom:1px solid #000"></div>`);
      } else if (b.kind === "table") {
        out.push(this.table(b));
      } else {
        out.push(this.para(b, pending));
        pending = "";
      }
    }
    return out.join("\n");
  }

  render(): string {
    const { page, marking } = this.ir;
    const fonts = `"${page.font}", ${this.opts.fallbackFonts ?? '"TH Sarabun New", "Sarabun", sans-serif'}`;
    const style = [
      `width:${page.widthCm}cm`,
      `min-height:${page.heightCm}cm`,
      // มีหัวกระดาษกำหนดเอง: แสดงหัวที่ระยะหัวกระดาษ (0.8 ซม.) แล้วต่อด้วยเนื้อหา
      `padding:${this.ir.header ? 0.8 : page.marginTopCm}cm ${page.marginRightCm}cm ${page.marginBottomCm}cm ${page.marginLeftCm}cm`,
      `font-family:${fonts}`,
      `font-size:${page.sizePt}pt`,
    ].join(";");
    const mark = (runs: Run[] | undefined, cls: string, pos: string) =>
      runs ? `<div class="${cls}" style="${pos}">${runs.map((r) => this.run(r)).join("")}</div>` : "";
    return [
      `<div class="thd-page" style="${esc(style)}" lang="th">`, // ชื่อฟอนต์มี " — ต้อง escape ไม่งั้น attribute ขาด
      mark(marking?.everyPage, "thd-mark-top", "top:0.3cm"),
      mark(marking?.firstPageLeft, "thd-mark-left", `top:0.2cm;left:${page.marginLeftCm}cm`),
      mark(marking?.everyPage, "thd-mark-bottom", "bottom:0.3cm"),
      this.ir.header ? `<div class="thd-header">${this.blocks(this.ir.header)}</div>` : "",
      this.blocks(this.ir.blocks),
      "</div>",
    ].join("\n");
  }
}

export function renderHtml(ir: DocIR, opts: HtmlOptions = {}): string {
  return new Html(ir, opts).render();
}
