import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { assembleDraft, check, contextFromDraft, type DraftFile } from "@thdocs/core";
import { renderDocx } from "@thdocs/render-docx";
import { renderHtml } from "@thdocs/render-html";
import { isoPack, policy, procedure } from "@thdocs/templates-iso";
import { ISO_SAMPLES } from "../examples/samples";

const profile = isoPack.demoProfile!;

async function render(file: DraftFile) {
  const def = isoPack.types.find((t) => t.id === file.type)!;
  const ctx = contextFromDraft(file, profile);
  const doc = assembleDraft(def, file, ctx);
  const ir = def.layout(doc, ctx);
  const zip = await JSZip.loadAsync(await renderDocx(ir));
  const files = Object.keys(zip.files);
  const read = async (p: string) => (await zip.file(p)!.async("string")).replace(/​/g, "");
  const headers = await Promise.all(files.filter((p) => /word\/header\d+\.xml/.test(p)).map(read));
  return { def, ctx, doc, ir, xml: await read("word/document.xml"), headers };
}

describe.each(Object.keys(ISO_SAMPLES))("ISO: %s", (name) => {
  it("ตารางควบคุมเอกสารอยู่ที่หัวกระดาษ มีรหัส ฉบับแก้ไข และ หน้า x / y", async () => {
    const { headers } = await render(ISO_SAMPLES[name]!);
    const h = headers.join("");
    expect(h).toContain("<w:tbl>");
    expect(h).toContain("รหัสเอกสาร:");
    expect(h).toContain("ฉบับแก้ไขที่: 00");
    expect(h).toMatch(/PAGE[\s\S]*NUMPAGES/);
  });

  it("ใช้เลขอารบิก และตัวอย่างไม่มี error", async () => {
    const { xml, def, doc, ctx } = await render(ISO_SAMPLES[name]!);
    expect(xml).not.toMatch(/[๐-๙]/);
    expect(check(def, doc, ctx).filter((f) => f.level === "error")).toEqual([]);
  });

  it("ไม่มีตราครุฑ (เอกสารเอกชน)", async () => {
    const def = isoPack.types.find((t) => t.id === name)!;
    const file = ISO_SAMPLES[name]!;
    const ctx = contextFromDraft(file, profile);
    expect(def.layout(assembleDraft(def, file, ctx), ctx).blocks.some((b) => b.kind === "emblem")).toBe(false);
  });
});

describe("ISO รายละเอียด", () => {
  it("ขั้นตอนการปฏิบัติงาน: ตารางขั้นตอนมีหัวคอลัมน์ซ้ำทุกหน้า และตารางลงนาม/บันทึกการแก้ไข", async () => {
    const { xml } = await render(ISO_SAMPLES.iso_procedure!);
    expect(xml).toContain("<w:tblHeader/>");
    for (const t of ["ขั้นตอน / รายละเอียด", "ผู้รับผิดชอบ", "จัดทำโดย", "อนุมัติโดย", "บันทึกการแก้ไขเอกสาร", "จัดทำครั้งแรก"]) expect(xml).toContain(t);
  });

  it("ขั้นตอนที่ไม่มีผู้รับผิดชอบ และเป้าหมายที่ไม่มีตัวเลข ถูกจับ", () => {
    const f1 = ISO_SAMPLES.iso_procedure!;
    const w1 = f1.wording as { steps: { step: string; responsible: string; record: string }[] };
    const bad1 = { ...f1, wording: { ...w1, steps: [{ step: "ทำงาน", responsible: "", record: "-" }] } };
    const c1 = contextFromDraft(bad1, profile);
    expect(check(procedure, assembleDraft(procedure, bad1, c1), c1).map((f) => f.rule)).toContain("ISO_OWNER");

    const f2 = ISO_SAMPLES.iso_policy!;
    const w2 = f2.wording as { objectives: Record<string, string>[] };
    const bad2 = { ...f2, wording: { ...w2, objectives: [{ ...w2.objectives[0]!, target: "ดีขึ้น" }] } };
    const c2 = contextFromDraft(bad2, profile);
    expect(check(policy, assembleDraft(policy, bad2, c2), c2).map((f) => f.rule)).toContain("ISO_MEASURABLE");
  });

  it("ประวัติการแก้ไขจากผู้ใช้ และแถวล่าสุดต้องตรงฉบับปัจจุบัน", async () => {
    const f = { ...ISO_SAMPLES.iso_procedure!, facts: { ...ISO_SAMPLES.iso_procedure!.facts, revision: "02", revisionHistory: "00 | 1 ม.ค. 2568 | จัดทำครั้งแรก | ก\n01 | 1 ก.ค. 2568 | เพิ่มขั้นตอนตรวจรับ | ข" } };
    const c = contextFromDraft(f, profile);
    const doc = assembleDraft(procedure, f, c);
    expect(doc.control.history).toHaveLength(2);
    expect(check(procedure, doc, c).map((x) => x.rule)).toContain("ISO_HISTORY");
  });

  it("ตรวจติดตามภายใน: ระบบนับจำนวนตามประเภทเอง และข้อบกพร่องที่ไม่มีหลักฐานถูกจับ", async () => {
    const { internalAudit } = await import("@thdocs/templates-iso");
    const f = ISO_SAMPLES.iso_internal_audit!;
    const c = contextFromDraft(f, profile);
    const doc = assembleDraft(internalAudit, f, c);
    expect(doc.counts).toEqual({ ข้อบกพร่องหลัก: 0, ข้อบกพร่องย่อย: 1, ข้อสังเกต: 1, จุดเด่น: 1 });
    const w = f.wording as { findings: Record<string, string>[] };
    const bad = { ...f, wording: { ...w, findings: [{ ...w.findings[0]!, evidence: "" }] } };
    const cb = contextFromDraft(bad, profile);
    expect(check(internalAudit, assembleDraft(internalAudit, bad, cb), cb).map((x) => x.rule)).toContain("IA_EVIDENCE");
  });

  it("CAR: ไม่มีสาเหตุที่แท้จริงถูกเตือน และ AI ระบุประเภทผลตรวจนอกรายการไม่ได้", async () => {
    const { car, internalAudit } = await import("@thdocs/templates-iso");
    const f = ISO_SAMPLES.iso_car!;
    const bad = { ...f, wording: { ...(f.wording as object), rootCause: ["[ระบุ: สาเหตุที่แท้จริง]"] } };
    const c = contextFromDraft(bad, profile);
    expect(check(car, assembleDraft(car, bad, c), c).map((x) => x.rule)).toContain("CAR_ROOT_CAUSE");
    const w = ISO_SAMPLES.iso_internal_audit!.wording as { findings: Record<string, string>[] };
    expect(internalAudit.wordingSchema.safeParse({ ...w, findings: [{ ...w.findings[0]!, type: "ร้ายแรงมาก" }] }).success).toBe(false);
  });

  it("พรีวิว HTML แสดงตารางหัวกระดาษและตาราง", () => {
    const file = ISO_SAMPLES.iso_form!;
    const def = isoPack.types.find((t) => t.id === file.type)!;
    const ctx = contextFromDraft(file, profile);
    const h = renderHtml(def.layout(assembleDraft(def, file, ctx), ctx));
    expect(h).toContain('class="thd-header"');
    expect((h.match(/<table class="thd-table"/g) ?? []).length).toBeGreaterThanOrEqual(2);
    expect(h).toContain("☐");
  });
});
