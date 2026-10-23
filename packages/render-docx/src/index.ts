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
  Tab,
  TabStopType,
  TextRun,
  TextWrappingType,
  VerticalPositionRelativeFrom,
} from "docx";
import { PLACEHOLDER_RE, keepNumberUnits, thaiWordBreaks, toThaiDigits, type Align, type Block, type DocIR, type Emblem, type Para, type Run } from "@thdocs/core";
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
    return keepNumberUnits(this.ir.page.thaiDigits ? toThaiDigits(t) : t);
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

  private body(blocks: Block[]): Paragraph[] {
    const out: Paragraph[] = [];
    let pendingFloat: ImageRun[] = [];
    for (const b of blocks) {
      if (b.kind === "emblem") {
        if (b.placement === "center") out.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [this.image(b)] }));
        else pendingFloat = [this.image(b)]; // ยึดกับย่อหน้าถัดไป
      } else if (b.kind === "blank") {
        for (let i = 0; i < b.lines; i++) out.push(new Paragraph({ keepNext: b.keepWithNext ?? false, children: [] }));
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
    const { marking, page } = this.ir;
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
            titlePage: true,
            page: {
              size: { width: tw(page.widthCm), height: tw(page.heightCm) },
              margin: {
                top: tw(page.marginTopCm),
                bottom: tw(page.marginBottomCm),
                left: tw(page.marginLeftCm),
                right: tw(page.marginRightCm),
                header: tw(0.8),
                footer: tw(0.8),
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

export { placeholderPng, pngSize } from "./png";
