import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { assembleDraft, check, contextFromDraft, marginsFor, type OrgProfile } from "@thdocs/core";
import { renderDocx } from "@thdocs/render-docx";
import { renderHtml } from "@thdocs/render-html";
import { isoPack } from "@thdocs/templates-iso";
import { externalLetter, thGovPack } from "@thdocs/templates-thgov";
import { ISO_SAMPLES, PROFILE, SAMPLES } from "../examples/samples";

const tw = (cm: number) => Math.round((cm * 1440) / 2.54);

async function docxXml(profile: OrgProfile) {
  const f = SAMPLES.external_letter!;
  const ctx = contextFromDraft(f, profile);
  const zip = await JSZip.loadAsync(await renderDocx(externalLetter.layout(assembleDraft(externalLetter, f, ctx), ctx)));
  return zip.file("word/document.xml")!.async("string");
}

describe("ระยะขอบกระดาษ", () => {
  it("หนังสือราชการ: ค่าตั้งต้น บน 2.5 ล่าง 2 ซ้าย 3 ขวา 2 หัวกระดาษ 1.25 ซม.", async () => {
    const xml = await docxXml(PROFILE);
    expect(xml).toContain(`w:top="${tw(2.5)}"`);
    expect(xml).toContain(`w:left="${tw(3)}"`);
    expect(xml).toContain(`w:right="${tw(2)}"`);
    expect(xml).toContain(`w:header="${tw(1.25)}"`);
  });

  it("หน่วยงานปรับขอบบนได้ และไม่เตือนเพราะขอบบนไม่มีค่ามาตรฐานบังคับ", async () => {
    const p = { ...PROFILE, margins: { "th-gov": { topCm: 1.9 } } };
    expect(await docxXml(p)).toContain(`w:top="${tw(1.9)}"`);
    const f = SAMPLES.external_letter!;
    const c = contextFromDraft(f, p);
    expect(check(externalLetter, assembleDraft(externalLetter, f, c), c).map((x) => x.rule)).not.toContain("PAGE_MARGIN");
  });

  it("ปรับขอบซ้ายต่างจากมาตรฐาน 3 ซม. → เตือน", () => {
    const p = { ...PROFILE, margins: { "th-gov": { leftCm: 2.5 } } };
    const f = SAMPLES.external_letter!;
    const c = contextFromDraft(f, p);
    const w = check(externalLetter, assembleDraft(externalLetter, f, c), c).filter((x) => x.rule === "PAGE_MARGIN");
    expect(w).toHaveLength(1);
    expect(w[0]!.message).toContain("ขอบซ้าย 2.5 ซม.");
  });

  it("ค่าผิดปกติ (ติดลบ ใหญ่เกิน ไม่ใช่ตัวเลข) ใช้ค่าตั้งต้นแทน", () => {
    const m = marginsFor("th-gov", thGovPack.page!, { ...PROFILE, margins: { "th-gov": { topCm: -1, leftCm: 50, rightCm: Number.NaN } } });
    expect(m).toEqual(thGovPack.page!.margins);
  });

  it("ขอบกว้างขึ้นจนพื้นที่ข้อความแคบ → ตาราง ISO ย่อตามสัดส่วนไม่ล้นขอบ", async () => {
    const f = ISO_SAMPLES.iso_procedure!;
    const def = isoPack.types.find((t) => t.id === f.type)!;
    const ctx = contextFromDraft(f, { ...isoPack.demoProfile!, margins: { iso: { leftCm: 4, rightCm: 4 } } });
    const zip = await JSZip.loadAsync(await renderDocx(def.layout(assembleDraft(def, f, ctx), ctx)));
    const xml = await zip.file("word/document.xml")!.async("string");
    const widths = [...xml.matchAll(/<w:tblW w:type="dxa" w:w="(\d+)"\/>/g)].map((m) => Number(m[1]));
    expect(widths.length).toBeGreaterThan(0);
    for (const w of widths) expect(w).toBeLessThanOrEqual(tw(13) + 2);
  });

  it("พรีวิวแสดงเส้นระยะขอบเมื่อเปิด และไม่แสดงเมื่อปิด", () => {
    const f = SAMPLES.memo!;
    const def = thGovPack.types.find((t) => t.id === "memo")!;
    const ctx = contextFromDraft(f, PROFILE);
    const ir = def.layout(assembleDraft(def, f, ctx), ctx);
    expect(renderHtml(ir, { showMargins: true })).toContain("ซ้าย ๓ ซม.");
    expect(renderHtml(ir)).not.toContain('class="thd-guide"');
  });
});
