import { describe, expect, it } from "vitest";
import { check } from "@thdocs/core";
import { SAMPLES } from "../examples/samples";
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

  it("มีตรา (หรือกรอบแทนตรา) และเลขหน้าเริ่มหน้า ๒", async () => {
    const { xml, parts } = await renderSample(SAMPLES[name]!);
    expect(parts.some((p) => p.startsWith("word/media/"))).toBe(true);
    expect(xml).toContain("<w:titlePg/>");
    expect(xml).toContain('w:fmt="thaiNumbers"');
  });

  it("ตัวอย่างไม่มี error ตามกฎตรวจ", async () => {
    const { def, doc, ctx } = await renderSample(SAMPLES[name]!);
    expect(check(def, doc, ctx).filter((f) => f.level === "error")).toEqual([]);
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
