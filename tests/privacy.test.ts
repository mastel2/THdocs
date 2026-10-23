import { describe, expect, it } from "vitest";
import { PiiMasker, draft, extractFacts, type Context, type PrivacyAudit } from "@thdocs/core";
import { MockLLM } from "@thdocs/llm";
import { PROFILE, SAMPLES } from "../examples/samples";
import { typeOf } from "./helpers";

const mask = (s: string) => new PiiMasker().mask(s);

describe("ปิดบังข้อมูลส่วนบุคคล", () => {
  it.each([
    ["เลขบัตร 1-1015-00012-34-5", "เลขบัตร ⟦เลขบัตร1⟧"],
    ["เลขบัตร ๑๑๐๑๕๐๐๐๑๒๓๔๕", "เลขบัตร ⟦เลขบัตร1⟧"],
    ["โทร 081-234-5678 หรือ 02 123 4567", "โทร ⟦โทร1⟧ หรือ ⟦โทร2⟧"],
    ["โทร +66 81 234 5678", "โทร ⟦โทร1⟧"],
    ["อีเมล somchai.j@example.co.th", "อีเมล ⟦อีเมล1⟧"],
    ["โอนเข้าบัญชี 123-4-56789-0", "โอนเข้าบัญชี ⟦บัญชี1⟧"],
    ["บัญชีเลขที่ 1234567890", "บัญชีเลขที่ ⟦บัญชี1⟧"],
    ["รับรองว่า นางสาวสมหญิง ใจดี เป็นพนักงาน", "รับรองว่า ⟦ชื่อ1⟧ เป็นพนักงาน"],
    ["เชิญ ดร.สมศักดิ์ รักไทย และ ผศ. วิไล ศรีสุข", "เชิญ ⟦ชื่อ1⟧ และ ⟦ชื่อ2⟧"],
    ["นายแพทย์ประเสริฐ มั่นคง", "⟦ชื่อ1⟧"],
  ])("%s", (input, expected) => {
    expect(mask(input)).toBe(expected);
  });

  it.each([
    "เสนอนายกรัฐมนตรีเพื่อทราบ",
    "นายอำเภอเมืองตัวอย่าง",
    "ส่งนายทะเบียนพิจารณา",
    "นางพยาบาลประจำหอผู้ป่วย",
    "งบประมาณ 12,000 บาท วันที่ 20 พฤศจิกายน 2569",
    "ที่ ตย 0001/123",
    "จำนวน 50 คน",
  ])("ไม่ปิดบังสิ่งที่ไม่ใช่ข้อมูลส่วนบุคคล: %s", (input) => {
    expect(mask(input)).toBe(input);
  });

  it("ค่าเดิมได้รหัสเดิม และคืนค่าได้แม้ AI เปลี่ยนเป็นเลขไทยหรือ [[...]]", () => {
    const m = new PiiMasker();
    expect(m.mask("นายสมชาย ใจดี โทร 0812345678 ติดต่อนายสมชาย ใจดี")).toBe("⟦ชื่อ1⟧ โทร ⟦โทร1⟧ ติดต่อ⟦ชื่อ1⟧");
    expect(m.unmask({ a: ["เรียน ⟦ชื่อ๑⟧", "โทร [[โทร1]]"], b: "⟦ชื่อ 1⟧" })).toEqual({
      a: ["เรียน นายสมชาย ใจดี", "โทร 0812345678"],
      b: "นายสมชาย ใจดี",
    });
  });
});

describe("ใช้ในลำดับงาน", () => {
  const cert = typeOf("certificate");
  const ctx: Context = { profile: PROFILE, options: { date: new Date("2026-10-23T03:00:00Z") } };
  const request = "ออกหนังสือรับรองให้ นางสาวสมหญิง ใจดี เลขบัตร 1-1015-00012-34-5 โทร 081-234-5678";

  it("AI ภายนอกไม่เห็นข้อมูลจริง แต่ผลลัพธ์ได้ค่าจริงกลับมา และรายงานรายการที่ปิดบัง", async () => {
    const llm = new MockLLM([{ personName: "⟦ชื่อ1⟧", personDetail: null, certifyWhat: null, usage: null }], true);
    const audit: PrivacyAudit = { masked: [] };
    const { facts } = await extractFacts(llm, cert, request, ctx, {}, audit);
    const sent = llm.calls[0]!.system + llm.calls[0]!.user;
    expect(sent).not.toMatch(/สมหญิง|1-1015|081-234/);
    expect(sent).toContain("⟦ชื่อ1⟧");
    expect(facts.personName).toBe("นางสาวสมหญิง ใจดี");
    expect(audit.masked.map((m) => m.kind).sort()).toEqual(["ชื่อ", "เลขบัตร", "โทร"].sort());
  });

  it("ขั้นร่างก็ปิดบังข้อเท็จจริงที่ส่งไป", async () => {
    const wording = { body: ["หนังสือฉบับนี้ให้ไว้เพื่อรับรองว่า ⟦ชื่อ1⟧ เป็นพนักงาน"] };
    const llm = new MockLLM([wording], true);
    const file = await draft(llm, cert, request, { personName: "นางสาวสมหญิง ใจดี" }, ctx);
    expect(llm.calls[0]!.user).not.toContain("สมหญิง");
    expect((file.wording as typeof wording).body[0]).toContain("นางสาวสมหญิง ใจดี");
  });

  it("AI ในเครื่องได้ข้อความเดิม ไม่ต้องปิดบัง", async () => {
    const llm = new MockLLM([{ personName: null }], false);
    await extractFacts(llm, cert, request, ctx);
    expect(llm.calls[0]!.user).toContain("นางสาวสมหญิง ใจดี");
  });

  it("รหัสที่ AI ทำเพี้ยนจนคืนค่าไม่ได้ ถูกตรวจพบเป็น error", async () => {
    const { check, assembleDraft, contextFromDraft } = await import("@thdocs/core");
    const file = { ...SAMPLES.certificate!, wording: { body: ["หนังสือฉบับนี้ให้ไว้เพื่อรับรองว่า ⟦ชื่อ9⟧ เป็นพนักงาน"] } };
    const c = contextFromDraft(file, PROFILE);
    expect(check(cert, assembleDraft(cert, file, c), c).map((f) => f.rule)).toContain("AI_DEBRIS");
  });
});
