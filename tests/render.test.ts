import { describe, expect, it } from "vitest";
import { check } from "@thdocs/core";
import { PROFILE, SAMPLES } from "../examples/samples";
import { renderSample } from "./helpers";

const cmToTwip = (cm: number) => Math.round((cm * 1440) / 2.54);

describe.each(Object.keys(SAMPLES))("%s", (name) => {
  it("ได้ A4 ขอบซ้าย ๓ ซม. ขวา ๒ ซม. ฟอนต์ TH SarabunPSK ๑๖ พอยท์", async () => {
    const { xml, zip } = await renderSample(SAMPLES[name]!);
    expect(xml).toContain(`w:w="${cmToTwip(21)}"`);
    expect(xml).toContain(`w:left="${cmToTwip(3)}"`);
    expect(xml).toContain(`w:right="${cmToTwip(2)}"`);
    const styles = await zip.file("word/styles.xml")!.async("string");
    expect(styles).toContain('w:cs="TH SarabunPSK"');
    expect(styles).toMatch(/<w:szCs w:val="32"\/>/);
  });

  it("แปลงเป็นเลขไทย ยกเว้นอีเมล", async () => {
    const { text } = await renderSample(SAMPLES[name]!);
    expect(text.replace(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g, "")).not.toMatch(/[0-9]/);
  });

  it("ตราครุฑ (หรือกรอบแทนตรา) ตามระเบียบ และเลขหน้าเริ่มหน้า ๒", async () => {
    const { xml, parts } = await renderSample(SAMPLES[name]!);
    // รายงานการประชุมไม่ใช้กระดาษตราครุฑ (ข้อ ๒๕) — ชนิดอื่นใช้ทั้งหมด
    expect(parts.some((p) => p.startsWith("word/media/"))).toBe(name !== "minutes");
    expect(xml).toContain("<w:titlePg/>");
    expect(xml).toContain('w:fmt="thaiNumbers"');
  });

  it("ตัวอย่างไม่มี error ตามกฎตรวจ", async () => {
    const { def, doc, ctx } = await renderSample(SAMPLES[name]!);
    expect(check(def, doc, ctx).filter((f) => f.level === "error")).toEqual([]);
  });
});

describe("หนังสือราชการครบ ๑๑ ชนิดตามระเบียบ", () => {
  it("มีทุกชนิด และทุกชนิดมีตัวอย่าง", async () => {
    const { thGovPack } = await import("@thdocs/templates-thgov");
    const ids = thGovPack.types.map((t) => t.id);
    for (const id of ["external_letter", "memo", "stamp_letter", "order", "regulation", "bylaw", "announcement", "statement", "news", "certificate", "minutes"]) {
      expect(ids).toContain(id);
    }
    expect(thGovPack.types.every((t) => t.example)).toBe(true);
  });

  it("ระเบียบ: ระบบประกอบข้อ ๑ ชื่อ, ข้อ ๒ วันใช้บังคับ และข้อสุดท้ายผู้รักษาการเอง", async () => {
    const { text } = await renderSample(SAMPLES.regulation!);
    expect(text).toContain('ข้อ ๑  ระเบียบนี้เรียกว่า "ระเบียบสำนักงานตัวอย่าง ว่าด้วยการใช้รถยนต์ส่วนกลาง พ.ศ. ๒๕๖๙"');
    expect(text).toContain("ข้อ ๒  ระเบียบนี้ให้ใช้บังคับตั้งแต่วันถัดจากวันประกาศเป็นต้นไป");
    expect(text).toContain("ข้อ ๖  ให้ผู้อำนวยการสำนักงานตัวอย่างรักษาการตามระเบียบนี้");
    expect(text).toContain("ประกาศ ณ วันที่ ๒๓ ตุลาคม พ.ศ. ๒๕๖๙");
  });

  it("คำสั่ง: หัว เลขที่/ปี เส้นคั่น และ สั่ง ณ วันที่", async () => {
    const { text, xml } = await renderSample(SAMPLES.order!);
    expect(text).toContain("คำสั่งสำนักงานตัวอย่าง");
    expect(text).toContain("ที่ ๑๒๐/๒๕๖๙");
    expect(text).toContain("สั่ง ณ วันที่ ๒๓ ตุลาคม พ.ศ. ๒๕๖๙");
    expect(xml).toContain("<w:pBdr>");
  });

  it("แถลงการณ์/ข่าว ไม่มีลายมือชื่อ ลงชื่อส่วนราชการแทน", async () => {
    const { text } = await renderSample(SAMPLES.news!);
    expect(text).not.toContain("(นายตัวอย่าง");
    expect(text).toMatch(/สำนักงานตัวอย่าง๒๓ ตุลาคม ๒๕๖๙$/);
  });

  it("รายงานการประชุม: ผู้มาประชุม ระเบียบวาระ มติ และผู้จดรายงาน", async () => {
    const { text } = await renderSample(SAMPLES.minutes!);
    expect(text).toContain("รายงานการประชุมคณะกรรมการบริหารสำนักงานตัวอย่าง");
    expect(text).toContain("ผู้มาประชุม");
    expect(text).toContain("ระเบียบวาระที่ ๒");
    expect(text).toContain("มติที่ประชุม");
    expect(text).toContain("เลิกประชุมเวลา ๑๑.๐๐ น.");
    expect(text).toContain("ผู้จดรายงานการประชุม");
  });

  it("ข้อบังคับที่ไม่อ้างอำนาจกฎหมายถูกจับ", async () => {
    const { check, assembleDraft, contextFromDraft } = await import("@thdocs/core");
    const { bylaw } = await import("@thdocs/templates-thgov");
    const file = { ...SAMPLES.bylaw!, wording: { ...(SAMPLES.bylaw!.wording as object), preamble: "เพื่อความเรียบร้อย จึงออกข้อบังคับไว้ ดังต่อไปนี้" } };
    const c = contextFromDraft(file, PROFILE);
    expect(check(bylaw, assembleDraft(bylaw, file, c), c).map((f) => f.rule)).toContain("BYLAW_AUTHORITY");
  });
});

describe("รายละเอียดการจัดหน้า", () => {
  it("ข้อความใช้ thaiDistribute และย่อหน้า ๒.๕ ซม.", async () => {
    const { xml } = await renderSample(SAMPLES.external_letter!);
    expect(xml).toContain('<w:jc w:val="thaiDistribute"/>');
    expect(xml).toContain(`w:firstLine="${cmToTwip(2.5)}"`);
  });

  it("หนังสือภายนอก: คำขึ้นต้น/ลงท้ายตามฐานะผู้รับ และส่วนลงนามไม่แยกหน้า", async () => {
    const { text, xml } = await renderSample(SAMPLES.external_letter!);
    expect(text).toContain("เรียน");
    expect(text).toContain("ขอแสดงความนับถือ");
    expect(text).toContain("(นายตัวอย่าง ทดสอบระบบ)");
    expect(xml).toContain("<w:keepNext/>");
  });

  it("แทรกจุดตัดคำไทยที่ขอบคำ ไม่แทรกข้างช่องว่างหรือตัวอักษรอังกฤษ", async () => {
    const { rawXml } = await renderSample(SAMPLES.external_letter!);
    expect(rawXml).toContain("ขอ​เชิญ");
    expect(rawXml).not.toMatch(/ ​|​ |[a-z]​/);
  });

  it("ช่อง [ระบุ...] ถูกไฮไลต์", async () => {
    const { xml } = await renderSample(SAMPLES.external_letter!);
    expect(xml).toMatch(/<w:highlight w:val="yellow"\/>[\s\S]*?\[ระบุ: ชื่อวิทยากร\]/);
  });

  it("บันทึกข้อความ: หัว ๒๙ พอยท์ ป้าย ๒๐ พอยท์ ตราลอยซ้าย และชั้นความเร็วในหัวกระดาษหน้าแรก", async () => {
    const { xml, zip } = await renderSample(SAMPLES.memo!);
    expect(xml).toMatch(/<w:sz w:val="58"\/>[\s\S]*?บันทึกข้อความ/);
    expect(xml).toMatch(/<w:sz w:val="40"\/>[\s\S]*?วันที่/);
    expect(xml).toContain("<wp:anchor");
    const headers = await Promise.all(
      Object.keys(zip.files).filter((p) => /word\/header\d+\.xml/.test(p)).map(async (p) => (await zip.file(p)!.async("string")).replace(/​/g, "")),
    );
    expect(headers.some((h) => h.includes("ด่วน") && h.includes('w:val="64"'))).toBe(true);
  });

  it("หนังสือรับรอง: ให้ไว้ ณ วันที่ มี พ.ศ.", async () => {
    const { text } = await renderSample(SAMPLES.certificate!);
    expect(text).toContain("ให้ไว้ ณ วันที่ ๒๓ ตุลาคม พ.ศ. ๒๕๖๙");
  });
});
