import { describe, expect, it } from "vitest";
import { thaiDate, toThaiDigits } from "@thdocs/core";
import { LLMError, OpenAICompatLLM, createLLM, parseJson } from "@thdocs/llm";

const req = { system: "s", user: "u", schema: { type: "object" }, schemaName: "memo" };

function fakeFetch(responses: { status: number; body: unknown }[], seen: any[] = []) {
  return (async (_url: string, init: RequestInit) => {
    seen.push(JSON.parse(String(init.body)));
    const r = responses.shift()!;
    return new Response(JSON.stringify(r.body), { status: r.status });
  }) as unknown as typeof fetch;
}

const reply = (content: string) => ({ status: 200, body: { choices: [{ message: { content } }] } });

describe("OpenAI-compatible", () => {
  it("ขอ json_schema ก่อน ถ้า endpoint ไม่รองรับลดเป็น json_object + schema ใน prompt", async () => {
    const seen: any[] = [];
    const llm = new OpenAICompatLLM({
      id: "ollama", baseUrl: "http://localhost:11434/v1", model: "m", external: false,
      fetch: fakeFetch([{ status: 400, body: { error: "unsupported" } }, reply('{"ok":true}')], seen),
    });
    expect(await llm.generateJson(req)).toEqual({ ok: true });
    expect(seen[0].response_format.type).toBe("json_schema");
    expect(seen[1].response_format.type).toBe("json_object");
    expect(seen[1].messages[0].content).toContain("JSON Schema");
  });

  it("401 แจ้งเรื่อง API key", async () => {
    const llm = new OpenAICompatLLM({ id: "openai", baseUrl: "https://x", model: "m", external: true, fetch: fakeFetch([{ status: 401, body: {} }]) });
    await expect(llm.generateJson(req)).rejects.toThrow(/API key/);
  });

  it("แยก JSON จากคำตอบที่มี <think> และ ```", () => {
    expect(parseJson('<think>คิด {ไม่ใช่}</think>\n```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(() => parseJson("ไม่มี")).toThrow(LLMError);
  });
});

describe("เลือกผู้ให้บริการ", () => {
  it("ollama/lmstudio = ในเครื่อง, openai/gemini/anthropic = ภายนอก", () => {
    const env = { OPENAI_API_KEY: "k", GEMINI_API_KEY: "k", ANTHROPIC_API_KEY: "k" };
    expect(createLLM({ provider: "ollama", model: "m" }, env).external).toBe(false);
    expect(createLLM({ provider: "lmstudio", model: "m" }, env).external).toBe(false);
    expect(createLLM({ provider: "openai", model: "m" }, env).external).toBe(true);
    expect(createLLM({ provider: "gemini", model: "m" }, env).external).toBe(true);
    expect(createLLM({ provider: "anthropic" }, env).external).toBe(true);
    expect(createLLM({ provider: "anthropic" }, env).model).toBe("claude-opus-5-5");
  });

  it("custom: ภายในถ้า URL เป็นเครือข่ายภายใน", () => {
    expect(createLLM({ provider: "custom", model: "m", baseUrl: "http://192.168.1.5:8000/v1" }, {}).external).toBe(false);
    expect(createLLM({ provider: "custom", model: "m", baseUrl: "https://llm.example.com/v1" }, {}).external).toBe(true);
  });

  it("ขาด key หรือชื่อโมเดล แจ้งชัด", () => {
    expect(() => createLLM({ provider: "openai", model: "m" }, {})).toThrow(/OPENAI_API_KEY/);
    expect(() => createLLM({ provider: "ollama" }, {})).toThrow(/ชื่อโมเดล/);
  });
});

describe("ภาษาไทย", () => {
  it("ตัวเลขกับหน่วยไม่แยกบรรทัด แต่ไม่แตะคำที่ขึ้นต้นเหมือนหน่วย", async () => {
    const { keepNumberUnits } = await import("@thdocs/core");
    expect(keepNumberUnits("จำนวน ๕๐ คน งบ 12,000 บาท")).toBe("จำนวน ๕๐ คน งบ 12,000 บาท");
    expect(keepNumberUnits("ปี 2569 คนละ")).toBe("ปี 2569 คนละ");
  });

  it("เลขไทยไม่แตะอีเมลและ URL", () => {
    expect(toThaiDigits("50 คน a1@x.go.th https://x.th/2569")).toBe("๕๐ คน a1@x.go.th https://x.th/2569");
    expect(thaiDate(new Date(2026, 9, 3), true)).toBe("๓ ตุลาคม พ.ศ. ๒๕๖๙");
  });
});
