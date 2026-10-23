import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { assembleDraft, contextFromDraft, exampleDraft } from "../packages/core/src";
import { inspectDocx, renderDocx } from "../packages/render-docx/src";
import { thGovPack } from "../packages/templates-thgov/src";
import { PROFILE } from "../examples/samples";

async function make(id: string) {
  const def = thGovPack.types.find((t) => t.id === id)!;
  const file = exampleDraft(def)!;
  const ctx = contextFromDraft(file, PROFILE);
  return renderDocx(def.layout(assembleDraft(def, file, ctx), ctx), {});
}
const opt = { page: thGovPack.page, fonts: ["TH SarabunPSK", "TH Sarabun New"], bodyPt: 16, expectEmblem: true };
async function edit(buf: Uint8Array, fn: (xml: string) => string) {
  const z = await JSZip.loadAsync(buf);
  z.file("word/document.xml", fn(await z.file("word/document.xml")!.async("string")));
  return z.generateAsync({ type: "uint8array" });
}
const rules = async (b: Uint8Array) => (await inspectDocx(b, opt)).findings.map((f) => f.rule);
const sect = (x: string, fn: (s: string) => string) => x.replace(/<w:sectPr>(?:(?!<w:sectPr>)[\s\S])*?<\/w:sectPr>(?![\s\S]*<w:sectPr>)/, fn);

describe("ตรวจไฟล์ .docx", () => {
  for (const t of thGovPack.types.filter((t) => t.id !== "minutes")) {
    it(`${t.id}: ไฟล์ที่ THdocs สร้างเองไม่มีข้อผิดพลาดด้านรูปแบบ`, async () => {
      const r = await inspectDocx(await make(t.id), { ...opt, expectEmblem: false });
      expect(r.findings.filter((f) => f.rule.startsWith("DOCX_") && f.level !== "info")).toEqual([]);
      expect(r.facts.margins?.leftCm).toBeCloseTo(3, 1);
    });
  }
  it("หนังสือภายนอกมีตราครุฑสูง 3 ซม.", async () => {
    const r = await inspectDocx(await make("external_letter"), opt);
    expect(r.findings.map((f) => f.rule)).not.toContain("DOCX_EMBLEM");
    expect(r.findings.map((f) => f.rule)).not.toContain("DOCX_EMBLEM_SIZE");
  });
  it("จับขอบซ้ายผิด กระดาษไม่ใช่ A4 ฟอนต์ผิด ขนาดผิด", async () => {
    const bad = await edit(await make("external_letter"), (x) =>
      sect(x, (s) => s.replace(/w:left="\d+"/, 'w:left="1134"').replace(/w:w="11906"/, 'w:w="12240"')).replace(/w:ascii="TH SarabunPSK" w:cs="TH SarabunPSK"/g, 'w:ascii="Calibri" w:cs="Calibri"').replace(/<w:rPr>/g, '<w:rPr><w:sz w:val="24"/>'));
    expect(await rules(bad)).toEqual(expect.arrayContaining(["DOCX_MARGIN", "DOCX_PAGE_SIZE", "DOCX_FONT", "DOCX_SIZE"]));
  });
  it("จับตราครุฑที่หายไป คำภาษาพูด และช่องที่ยังไม่กรอก", async () => {
    const bad = await edit(await make("external_letter"), (x) => x.replace(/<w:drawing>[\s\S]*?<\/w:drawing>/g, "").replace(/<w:t(?: [^>]*)?>/, '<w:t xml:space="preserve">ครับ [ระบุ: วันที่] '));
    expect(await rules(bad)).toEqual(expect.arrayContaining(["DOCX_EMBLEM", "INFORMAL", "PLACEHOLDER"]));
  });
  it("จับเลขไทยปนเลขอารบิก", async () => {
    const bad = await edit(await make("external_letter"), (x) => x.replace(/<w:t(?: [^>]*)?>/, "<w:t xml:space=\"preserve\">จำนวน 25 คน "));
    expect(await rules(bad)).toContain("DOCX_DIGITS");
  });
  it("ไฟล์ที่ไม่ใช่ docx ให้ error", async () => {
    await expect(inspectDocx(new TextEncoder().encode("hello"))).rejects.toThrow();
  });
});

describe("ไฟล์ที่สร้างจาก Microsoft Word จริง (fixtures)", () => {
  const read = async (n: string) => (await import("node:fs")).readFileSync(new URL(`./fixtures/${n}`, import.meta.url));
  it("Word: ตั้ง Normal เป็น TH SarabunPSK 16 ขอบ 3/2 → ไม่มีข้อผิดรูปแบบ แต่จับคำภาษาพูด", async () => {
    const r = await inspectDocx(await read("word-good.docx"), opt);
    expect(r.facts.fonts).toHaveProperty("TH SarabunPSK");
    expect(r.facts.sizes).toHaveProperty("16");
    const ids = r.findings.map((f) => f.rule);
    expect(ids).not.toContain("DOCX_FONT");
    expect(ids).not.toContain("DOCX_SIZE");
    expect(ids).not.toContain("DOCX_MARGIN");
    expect(ids).toContain("INFORMAL");
  });
  it("Word: เอกสารเปล่าค่าเริ่มต้นของ Word → จับขอบ ฟอนต์ ขนาด", async () => {
    const ids = (await inspectDocx(await read("word-default.docx"), opt)).findings.map((f) => f.rule);
    expect(ids).toEqual(expect.arrayContaining(["DOCX_MARGIN", "DOCX_FONT", "DOCX_SIZE"]));
  });
});

describe("แม่แบบ .dotx", () => {
  it("เปลี่ยนเฉพาะชนิดเนื้อหาเป็น template และยังตรวจได้เหมือนเดิม", async () => {
    const { toDotx } = await import("../packages/render-docx/src");
    const docx = await make("memo");
    const dotx = await toDotx(docx);
    const ct = await (await JSZip.loadAsync(dotx)).file("[Content_Types].xml")!.async("string");
    expect(ct).toContain("wordprocessingml.template.main+xml");
    expect(ct).not.toContain("wordprocessingml.document.main+xml");
    expect(await rules(dotx)).toEqual(await rules(docx));
    await expect(toDotx(dotx)).rejects.toThrow(); // ไม่ใช่ .docx แล้ว
  });
});
