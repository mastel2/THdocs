import { describe, expect, it } from "vitest";
import { ConfidentialError, rewriteText, type LLM, type LLMRequest, type PrivacyAudit } from "../packages/core/src";

function fake(external: boolean, answer: (req: LLMRequest) => unknown): LLM & { seen: LLMRequest[] } {
  const seen: LLMRequest[] = [];
  return { id: "fake", model: "m", external, seen, async generateJson(req) { seen.push(req); return answer(req); } };
}

describe("rewriteText (ปรับข้อความที่เลือกใน Word)", () => {
  it("ส่งข้อความไปพร้อมโหมด และคืนข้อความที่ปรับแล้ว", async () => {
    const llm = fake(false, () => ({ text: "  ขอเรียนว่า ...  " }));
    expect(await rewriteText(llm, "เลยขอบอกว่า", "formal")).toBe("ขอเรียนว่า ...");
    expect(llm.seen[0]!.system).toContain("ภาษาราชการ");
    expect(llm.seen[0]!.user).toBe("เลยขอบอกว่า");
  });
  it("ข้อความลับ + AI ภายนอก → ไม่ส่ง (ConfidentialError) และไม่เรียก AI", async () => {
    const llm = fake(true, () => ({ text: "x" }));
    await expect(rewriteText(llm, "เรื่องลับ", "formal", "ลับ")).rejects.toBeInstanceOf(ConfidentialError);
    expect(llm.seen).toHaveLength(0);
  });
  it("ข้อความลับ + AI ในเครื่อง → ทำได้", async () => {
    expect(await rewriteText(fake(false, () => ({ text: "ok" })), "เรื่องลับ", "fix", "ลับ")).toBe("ok");
  });
  it("AI ภายนอก: ปิดบังเลขบัตรประชาชน/เบอร์โทรก่อนส่ง แล้วใส่ค่าจริงกลับในผลลัพธ์", async () => {
    const audit: PrivacyAudit = { masked: [] };
    const llm = fake(true, (req) => ({ text: `ติดต่อ ${/⟦[^⟧]+⟧/.exec(req.user)?.[0]}` }));
    const out = await rewriteText(llm, "โทร 081-234-5678 ด้วย", "shorter", undefined, audit);
    expect(llm.seen[0]!.user).not.toContain("081-234-5678");
    expect(out).toBe("ติดต่อ 081-234-5678");
    expect(audit.masked.length).toBeGreaterThan(0);
  });
  it("คำตอบผิดรูปหรือว่าง → error ที่อ่านออก", async () => {
    await expect(rewriteText(fake(false, () => ({ text: "  " })), "ก", "formal")).rejects.toThrow("AI ตอบไม่ตรงโครงสร้าง");
    await expect(rewriteText(fake(false, () => "oops"), "ก", "formal")).rejects.toThrow("AI ตอบไม่ตรงโครงสร้าง");
  });
});
