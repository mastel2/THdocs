/** Document IR → .docx */
import { readFileSync } from "node:fs";
import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  Header,
  HorizontalPositionRelativeFrom,
  ImageRun,
  NumberFormat,
  Packer,
  PageNumber,
  Paragraph,
  ShadingType,
  Tab,
  Table,
  TableCell,
  TableRow,
  TabStopType,
  TextRun,
  TextWrappingType,
  VerticalAlignTable,
  VerticalPositionRelativeFrom,
  WidthType,
} from "docx";
import { PLACEHOLDER_RE, keepNumberUnits, toArabicDigits, thaiWordBreaks, toThaiDigits, type Align, type Block, type DocIR, type Emblem, type Para, type Run, type Table as TableBlock } from "@thdocs/core";
import { placeholderPng, pngSize } from "./png";

export interface RenderOptions {
  /** ไฟล์ตรา PNG (path หรือ Buffer) — ไม่มี = กรอบแทนตรา */
  emblemPng?: string | Buffer;
  /** ไฮไลต์ช่อง [ระบุ...] สีเหลือง (ค่าเริ่มต้น true) */
  highlightPlaceholders?: boolean;
  /** แทรกจุดตัดคำไทยที่มองไม่เห็น (ค่าเริ่มต้น true) */
  thaiWordBreaks?: boolean;
}

const tw = (cm: number) => Math.round((cm * 1440) / 2.54);
/** ต้องระบุภาษาไทย ไม่งั้น Word ตัดบรรทัดเฉพาะที่ช่องว่าง แล้ว thaiDistribute ยืดระยะตัวอักษรทั้งบรรทัด */
const THAI = { value: "th-TH", bidirectional: "th-TH" };
const PX_PER_CM = 96 / 2.54;
const EMU_PER_CM = 360000;

const ALIGN: Record<Align, (typeof AlignmentType)[keyof typeof AlignmentType]> = {
  left: AlignmentType.LEFT,
  center: AlignmentType.CENTER,
  right: AlignmentType.RIGHT,
  justify: AlignmentType.JUSTIFIED,
  thaiDistribute: AlignmentType.THAI_DISTRIBUTE,
};

const TAB: Record<"left" | "center" | "right", (typeof TabStopType)[keyof typeof TabStopType]> = {
  left: TabStopType.LEFT,
  center: TabStopType.CENTER,
  right: TabStopType.RIGHT,
};

class Renderer {
  private readonly emblem: { data: Buffer; ratio: number };

  constructor(private readonly ir: DocIR, private readonly opts: RenderOptions) {
    const src = opts.emblemPng;
    const data = src ? (typeof src === "string" ? readFileSync(src) : src) : placeholderPng();
    const { width, height } = pngSize(data);
    this.emblem = { data, ratio: width / height };
  }

  private font() {
    const f = this.ir.page.font;
    return { ascii: f, hAnsi: f, cs: f, eastAsia: f };
  }

  private textWidthCm() {
    const p = this.ir.page;
    return p.widthCm - p.marginLeftCm - p.marginRightCm;
  }

  private text(t: string) {
    // ตัวเลขตามค่าของเอกสารทั้งสองทาง — วันที่จาก thaiDate() เป็นเลขไทยเสมอ
    return keepNumberUnits(this.ir.page.thaiDigits ? toThaiDigits(t) : toArabicDigits(t));
  }

  private runs(run: Run): TextRun[] {
    const base = {
      font: this.font(),
      language: THAI,
      bold: run.bold,
      boldComplexScript: run.bold,
      ...(run.sizePt ? { size: run.sizePt * 2, sizeComplexScript: run.sizePt * 2 } : {}),
      ...(run.color ? { color: run.color } : {}),
    };
    if (run.field) return [new TextRun({ ...base, children: [run.field === "page" ? PageNumber.CURRENT : PageNumber.TOTAL_PAGES] })];
    const highlight = this.opts.highlightPlaceholders ?? true;
    const breaks = this.opts.thaiWordBreaks ?? true;
    // แยกช่อง [ระบุ...] ออกเป็น run ของตัวเองเพื่อไฮไลต์ (split ด้วยกลุ่มจับ → ส่วนคี่คือช่อง [ระบุ])
    const parts = highlight ? this.text(run.text).split(new RegExp(`(${PLACEHOLDER_RE.source})`)) : [this.text(run.text)];
    const out = parts
      .map((p, i) => ({ p: breaks ? thaiWordBreaks(p) : p, mark: highlight && i % 2 === 1 }))
      .filter(({ p }) => p !== "")
      .map(({ p, mark }) => new TextRun({ ...base, text: p, ...(mark ? { highlight: "yellow" } : {}) }));
    if (run.tabBefore) out.unshift(new TextRun({ ...base, children: [new Tab()] }));
    return out;
  }

  private image(e: Emblem) {
    const h = e.heightCm * PX_PER_CM;
    const transformation = { width: Math.round(h * this.emblem.ratio), height: Math.round(h) };
    if (e.placement === "center") return new ImageRun({ type: "png", data: this.emblem.data, transformation });
    return new ImageRun({
      type: "png",
      data: this.emblem.data,
      transformation,
      floating: {
        horizontalPosition: { relative: HorizontalPositionRelativeFrom.MARGIN, offset: 0 },
        verticalPosition: { relative: VerticalPositionRelativeFrom.PARAGRAPH, offset: Math.round(-0.2 * EMU_PER_CM) },
        wrap: { type: TextWrappingType.NONE },
        allowOverlap: true,
      },
    });
  }

  private paragraph(p: Para, leading: ImageRun[] = []): Paragraph {
    const indent = {
      ...(p.indentLeftCm ? { left: tw(p.indentLeftCm) } : {}),
      ...(p.firstLineCm ? { firstLine: tw(p.firstLineCm) } : {}),
      ...(p.hangingCm ? { hanging: tw(p.hangingCm) } : {}),
    };
    return new Paragraph({
      alignment: ALIGN[p.align ?? "left"],
      indent,
      spacing: { before: (p.spaceBeforePt ?? 0) * 20, after: (p.spaceAfterPt ?? 0) * 20 },
      ...(p.tabs ? { tabStops: p.tabs.map((t) => ({ type: TAB[t.align ?? "left"], position: tw(t.posCm) })) } : {}),
      keepNext: p.keepWithNext ?? false,
      children: [...leading, ...p.runs.flatMap((r) => this.runs(r))],
    });
  }

  private table(t: TableBlock): Table {
    // ผู้ใช้ปรับระยะขอบให้แคบลงได้ — ย่อตารางตามสัดส่วนให้ไม่ล้นขอบ
    const total = t.columnsCm.reduce((a, b) => a + b, 0);
    const scale = Math.min(1, this.textWidthCm() / total);
    const widths = t.columnsCm.map((w) => tw(w * scale));
    const line = { style: BorderStyle.SINGLE, size: 4, color: "000000" };
    return new Table({
      width: { size: widths.reduce((a, b) => a + b, 0), type: WidthType.DXA },
      columnWidths: widths,
      borders: { top: line, bottom: line, left: line, right: line, insideHorizontal: line, insideVertical: line },
      rows: t.rows.map((r, ri) => {
        // ห้ามแยกตาราง: ทุกย่อหน้าในแถวที่ไม่ใช่แถวสุดท้าย "อยู่กับย่อหน้าถัดไป" (วิธีมาตรฐานของ Word)
        const keep = !!t.keepTogether && ri < t.rows.length - 1;
        let col = 0;
        return new TableRow({
          tableHeader: r.header ?? false,
          cantSplit: true,
          children: r.cells.map((c) => {
            const span = c.span ?? 1;
            const width = widths.slice(col, col + span).reduce((a, b) => a + b, 0);
            col += span;
            return new TableCell({
              width: { size: width, type: WidthType.DXA },
              ...(span > 1 ? { columnSpan: span } : {}),
              ...(c.shade ? { shading: { fill: c.shade, type: ShadingType.CLEAR, color: "auto" } } : {}),
              verticalAlign: c.vAlign === "top" ? VerticalAlignTable.TOP : VerticalAlignTable.CENTER,
              margins: { top: 30, bottom: 30, left: 90, right: 90 },
              children: c.paras.length
                ? c.paras.map((p) => this.paragraph(keep ? { ...p, keepWithNext: true } : p))
                : [new Paragraph({ keepNext: keep, children: [] })],
            });
          }),
        });
      }),
    });
  }

  private body(blocks: Block[]): (Paragraph | Table)[] {
    const out: (Paragraph | Table)[] = [];
    let pendingFloat: ImageRun[] = [];
    for (const b of blocks) {
      if (b.kind === "emblem") {
        if (b.placement === "center") out.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [this.image(b)] }));
        else pendingFloat = [this.image(b)]; // ยึดกับย่อหน้าถัดไป
      } else if (b.kind === "blank") {
        for (let i = 0; i < b.lines; i++) out.push(new Paragraph({ keepNext: b.keepWithNext ?? false, children: [] }));
      } else if (b.kind === "table") {
        if (b.spaceBeforePt) out.push(new Paragraph({ spacing: { before: 0, after: 0, line: b.spaceBeforePt * 20, lineRule: "exact" }, children: [] }));
        out.push(this.table(b));
      } else if (b.kind === "rule") {
        // เส้นคั่น = ขอบล่างของย่อหน้าว่างที่บีบความกว้างด้วยเยื้องซ้ายขวาเท่ากัน
        const side = tw(Math.max(0, (this.textWidthCm() - b.widthCm) / 2));
        out.push(new Paragraph({
          indent: { left: side, right: side },
          spacing: { before: (b.spaceBeforePt ?? 0) * 20, after: (b.spaceAfterPt ?? 6) * 20, line: 120 },
          border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "000000", space: 1 } },
          children: [],
        }));
      } else {
        out.push(this.paragraph(b, pendingFloat));
        pendingFloat = [];
      }
    }
    return out;
  }

  private markParas(runs: Run[] | undefined, align: Align = "center"): Paragraph[] {
    return runs ? [this.paragraph({ kind: "para", runs, align })] : [];
  }

  private headersFooters() {
    const { marking, page, header } = this.ir;
    if (header) {
      // หัวกระดาษเดียวกันทุกหน้า (เช่น ตารางควบคุมเอกสาร ISO) — มีย่อหน้าว่างเล็กคั่นจากเนื้อหา
      const blocks = [...this.body(header), new Paragraph({ spacing: { after: 120 }, children: [] })];
      return { headers: { default: new Header({ children: blocks }) } };
    }
    if (!marking && !page.pageNumbers) return {};
    const pageNo = page.pageNumbers
      ? [new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ font: this.font(), children: ["- ", PageNumber.CURRENT, " -"] })],
        })]
      : [];
    const every = this.markParas(marking?.everyPage);
    return {
      headers: {
        first: new Header({ children: [...every, ...this.markParas(marking?.firstPageLeft, "left")] }),
        default: new Header({ children: [...every, ...pageNo] }),
      },
      footers: {
        first: new Footer({ children: [...every] }),
        default: new Footer({ children: [...every] }),
      },
    };
  }

  build(): Document {
    const { page } = this.ir;
    return new Document({
      title: this.ir.title,
      creator: "THdocs",
      styles: {
        default: {
          document: {
            run: { font: this.font(), language: THAI, size: page.sizePt * 2, sizeComplexScript: page.sizePt * 2 },
          },
        },
      },
      sections: [
        {
          properties: {
            titlePage: !this.ir.header, // หนังสือราชการ: หน้าแรกไม่มีเลขหน้า | มีหัวกระดาษกำหนดเอง: เหมือนกันทุกหน้า
            page: {
              size: { width: tw(page.widthCm), height: tw(page.heightCm) },
              margin: {
                top: tw(page.marginTopCm),
                bottom: tw(page.marginBottomCm),
                left: tw(page.marginLeftCm),
                right: tw(page.marginRightCm),
                header: tw(page.headerCm),
                footer: tw(page.headerCm),
              },
              ...(page.thaiDigits ? { pageNumbers: { start: 1, formatType: NumberFormat.THAI_NUMBERS } } : {}),
            },
          },
          ...this.headersFooters(),
          children: this.body(this.ir.blocks),
        },
      ],
    });
  }
}

export async function renderDocx(ir: DocIR, opts: RenderOptions = {}): Promise<Buffer> {
  return Packer.toBuffer(new Renderer(ir, opts).build());
}

export { drawPng, placeholderPng, pngSize } from "./png";
export * from "./inspect";
export * from "./template";
