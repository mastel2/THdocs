import { describe, expect, it } from "vitest";
import {
  ConfidentialError,
  assembleDraft,
  check,
  contextFromDraft,
  draft,
  extractFacts,
  revise,
  toLLMSchema,
  type Context,
} from "@thdocs/core";
import { MockLLM } from "@thdocs/llm";
import { salutationFor } from "@thdocs/templates-thgov";
import { PROFILE, SAMPLES } from "../examples/samples";
import { typeOf } from "./helpers";

const memo = typeOf("memo");
const ctx: Context = { profile: PROFILE, options: { date: new Date("2026-10-23T03:00:00Z") } };
const memoWording = SAMPLES.memo!.wording as Record<string, unknown>;

describe("ถามข้อมูลที่ขาดก่อนร่าง", () => {
  it("คืนรายการคำถามของข้อมูลบังคับที่ AI หาไม่เจอในคำขอ", async () => {
    const llm = new MockLLM([{ recipient: null, purpose: "ขออนุมัติจัดอบรม", details: null, docNo: null, date: null, signerName: null, signerPosition: null }]);
    const { facts, missing } = await extractFacts(llm, memo, "ขออนุมัติจัดอบรม", ctx);
    expect(facts.purpose).toBe("ขออนุมัติจัดอบรม");
    expect(missing.map((m) => m.key)).toEqual(["recipient"]);
  });

  it("ข้อมูลที่ผู้ใช้ให้เอง (--fact) ทับค่าที่ AI ดึงมา", async () => {
    const llm = new MockLLM([{ recipient: "ผิด", purpose: "x" }]);
    const { facts, missing } = await extractFacts(llm, memo, "x", ctx, { recipient: "ผู้อำนวยการ" });
    expect(facts.recipient).toBe("ผู้อำนวยการ");
    expect(missing).toEqual([]);
  });
});

describe("ร่างและแก้", () => {
  it("ระบบเติมเลขที่ วันที่ ผู้ลงนาม คำขึ้นต้น เอง ไม่ใช่ AI", async () => {
    const llm = new MockLLM([memoWording]);
    const file = await draft(llm, memo, "ขออนุมัติจัดอบรม", { recipient: "เรียน ผู้อำนวยการสำนักงานตัวอย่าง" }, ctx);
    const doc = assembleDraft(memo, file, contextFromDraft(file, PROFILE)) as Record<string, any>;
    expect(doc.recipient).toBe("ผู้อำนวยการสำนักงานตัวอย่าง");
    expect(doc.docNo).toBe("ตย 0001/[ระบุ: เลขทะเบียนส่ง]");
    expect(doc.date).toBe("๒๓ ตุลาคม ๒๕๖๙");
    expect(doc.signer.name).toBe("นายตัวอย่าง ทดสอบระบบ");
  });

  it("ไม่มีข้อมูลผู้รับ → ช่อง [ระบุ] แม้ AI จะแต่งผู้รับมาเอง", async () => {
    const llm = new MockLLM([{ ...memoWording, recipient: "ผู้บังคับบัญชา" }]);
    const file = await draft(llm, memo, "x", {}, ctx);
    const doc = assembleDraft(memo, file, contextFromDraft(file, PROFILE)) as Record<string, any>;
    expect(doc.recipient).toBe("[ระบุ: ตำแหน่งผู้รับ]");
    expect(JSON.stringify(file.wording)).not.toContain("ผู้บังคับบัญชา");
  });

  it("AI ตอบผิดโครงสร้าง → ส่งข้อผิดพลาดกลับให้แก้ ๑ รอบ", async () => {
    const llm = new MockLLM([{ subject: "x" }, memoWording]);
    await draft(llm, memo, "x", {}, ctx);
    expect(llm.calls).toHaveLength(2);
    expect(llm.calls[1]!.user).toContain("ไม่ตรงโครงสร้าง");
  });

  it("แก้ถ้อยคำแล้วชั้นความลับยังอยู่ แม้ AI ไม่ได้ส่งกลับมา", async () => {
    const secret: Context = { ...ctx, options: { ...ctx.options, secrecy: "ลับ" } };
    const file = await draft(new MockLLM([memoWording]), memo, "x", {}, secret);
    const revised = await revise(new MockLLM([{ ...memoWording, subject: "เรื่องใหม่" }]), memo, file, "เปลี่ยนเรื่อง", secret);
    expect(revised.options.secrecy).toBe("ลับ");
    expect((revised.wording as { subject: string }).subject).toBe("เรื่องใหม่");
  });
});

describe("เอกสารชั้นความลับ", () => {
  const secret: Context = { ...ctx, options: { secrecy: "ลับมาก" } };

  it.each([
    ["ดึงข้อมูล", (llm: MockLLM) => extractFacts(llm, memo, "เรื่องลับ", secret)],
    ["ร่าง", (llm: MockLLM) => draft(llm, memo, "เรื่องลับ", {}, secret)],
    ["แก้", (llm: MockLLM) => revise(llm, memo, SAMPLES.memo!, "แก้", secret)],
  ])("ขั้น%s ไม่ส่งให้ AI ภายนอก", async (_, run) => {
    const external = new MockLLM([memoWording], true);
    await expect(run(external)).rejects.toBeInstanceOf(ConfidentialError);
    expect(external.calls).toHaveLength(0);
  });

  it("local LLM ใช้ได้", async () => {
    await expect(draft(new MockLLM([memoWording], false), memo, "เรื่องลับ", {}, secret)).resolves.toBeTruthy();
  });
});

describe("กฎตรวจ", () => {
  it("เลขที่ไม่มี / และภาคสรุปผิดรูป ถูกจับ", () => {
    const file = { ...SAMPLES.memo!, facts: { docNo: "ตย 0001" } };
    const c = contextFromDraft(file, PROFILE);
    const rules = check(memo, assembleDraft(memo, file, c), c).map((f) => f.rule);
    expect(rules).toContain("DOC_NO");
  });

  it("พบภาษาพูด", () => {
    const file = { ...SAMPLES.memo!, wording: { ...memoWording, conclusion: "เลยขอความช่วยเหลือครับ" } };
    const c = contextFromDraft(file, PROFILE);
    const rules = check(memo, assembleDraft(memo, file, c), c).map((f) => f.rule);
    expect(rules).toContain("INFORMAL");
    expect(rules).toContain("BODY_CONCLUSION");
  });

  it("คำขึ้นต้นตามฐานะผู้รับ", () => {
    expect(salutationFor("นายกรัฐมนตรี").salutation).toBe("กราบเรียน");
    expect(salutationFor("พระครูสมุห์ตัวอย่าง").closing).toBe("ขอนมัสการด้วยความเคารพ");
    expect(salutationFor("ผู้ว่าราชการจังหวัดตัวอย่าง").salutation).toBe("เรียน");
    expect(salutationFor("สมเด็จพระ...").confident).toBe(false);
  });

  it("จับเศษข้อความจาก AI ที่ตอบผิดรูป แต่ไม่จับช่อง [ระบุ] อีเมล หรือข้อความปกติ", () => {
    const wording = {
      ...memoWording,
      cause: ["intent-detail-request-conclusion]: [", ".", "ด้วยกองบริหารทั่วไปเห็นควรจัดอบรม [ระบุ: วันที่]"],
      intent: ["ติดต่อ a-b@example.go.th"],
    };
    const file = { ...SAMPLES.memo!, wording };
    const c = contextFromDraft(file, PROFILE);
    const found = check(memo, assembleDraft(memo, file, c), c).filter((f) => f.rule.startsWith("AI_"));
    expect(found.map((f) => [f.rule, f.where])).toEqual([
      ["AI_DEBRIS", "cause[0]"],
      ["AI_EMPTY", "cause[1]"],
    ]);
  });

  it("ไม่จับคำที่เป็นส่วนของคำอื่น", async () => {
    const { hasThaiPhrase } = await import("@thdocs/core");
    expect(hasThaiPhrase("จึงเลยขอความกรุณา", "เลยขอ")).toBe(true);
    expect(hasThaiPhrase("แค่นั้น", "แค่")).toBe(true);
    expect(hasThaiPhrase("แคแสด", "แค่")).toBe(false);
  });
});

describe("schema สำหรับ AI", () => {
  it("object ปิด และทุก field required", () => {
    const s = toLLMSchema(memo.wordingSchema) as any;
    expect(s.additionalProperties).toBe(false);
    expect(s.required).toEqual(Object.keys(s.properties));
    const section = (toLLMSchema(typeOf("memo_proposal").wordingSchema) as any).properties.sections.items;
    expect(section.additionalProperties).toBe(false);
    expect(section.required).toEqual(["heading", "paragraphs"]);
  });
});
