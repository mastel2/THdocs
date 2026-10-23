/**
 * AI ในเครื่องผู้ใช้ที่เรียกจากเบราว์เซอร์ตรง ๆ (apps/web/lib/ai.ts)
 * ใช้เซิร์ฟเวอร์จำลองที่พูด OpenAI API แบบเดียวกับ Ollama/LM Studio (รวม CORS preflight) — ไม่ต้องโหลดโมเดลจริง
 */
import { createServer, type IncomingMessage, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { isLocalUrl, listModels } from "@thdocs/llm/openai-compat";
import { aiDraft, aiFacts, aiRevise, isExternal } from "../apps/web/lib/ai";
import { BROWSER_PROVIDERS } from "../apps/web/lib/registry";
import { PROFILE, SAMPLES } from "../examples/samples";

interface Seen {
  method: string;
  url: string;
  origin?: string;
  body?: { model: string; messages: { role: string; content: string }[]; response_format: { json_schema?: { name: string } } };
}

const memoWording = SAMPLES.memo!.wording;
const factsReply = { recipient: "ผู้อำนวยการกองคลัง", purpose: "ขออนุมัติ", details: null, docNo: null, date: null, signerName: null, signerPosition: null };

let server: Server;
let base: string;
const seen: Seen[] = [];
let delayMs = 0;

const readBody = (req: IncomingMessage) => new Promise<string>((ok) => { let s = ""; req.on("data", (c) => (s += c)); req.on("end", () => ok(s)); });

beforeAll(async () => {
  server = createServer(async (req, res) => {
    const cors = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Allow-Private-Network": "true",
    };
    const item: Seen = { method: req.method!, url: req.url!, ...(req.headers.origin ? { origin: req.headers.origin } : {}) };
    seen.push(item);
    if (req.method === "OPTIONS") return void res.writeHead(204, cors).end();
    if (req.url === "/v1/models") return void res.writeHead(200, { ...cors, "Content-Type": "application/json" }).end(JSON.stringify({ data: [{ id: "qwen3.5:9b" }, { id: "gemma3:12b" }] }));
    if (req.url === "/v1/chat/completions") {
      item.body = JSON.parse(await readBody(req));
      await new Promise((r) => setTimeout(r, delayMs));
      const name = item.body!.response_format.json_schema?.name;
      const content = name === "facts" ? factsReply : name === "memo" ? memoWording : { error: `ไม่รู้จัก ${name}` };
      return void res.writeHead(200, { ...cors, "Content-Type": "application/json" }).end(JSON.stringify({ choices: [{ message: { content: JSON.stringify(content) } }] }));
    }
    res.writeHead(404, cors).end();
  });
  await new Promise<void>((ok) => server.listen(0, "127.0.0.1", ok));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/v1`;
});

afterAll(() => new Promise<void>((ok) => server.close(() => ok())));
afterEach(() => {
  seen.length = 0;
  delayMs = 0;
  vi.unstubAllGlobals();
});

const LOCAL = () => ({ provider: "browser-ollama", model: "qwen3.5:9b", baseUrl: base });
const chats = () => seen.filter((s) => s.url === "/v1/chat/completions");

describe("ผู้ให้บริการที่รันในเบราว์เซอร์", () => {
  it("มี Ollama / LM Studio / ระบุเอง และ URL ตั้งต้นของ Ollama ถูกต้อง", () => {
    expect(BROWSER_PROVIDERS.map((p) => p.id)).toEqual(["browser-ollama", "browser-lmstudio", "browser-custom"]);
    expect(BROWSER_PROVIDERS[0]!.defaultUrl).toBe("http://localhost:11434/v1");
    expect(BROWSER_PROVIDERS.every((p) => p.browserSide)).toBe(true);
  });

  it("ตัดสินว่าออกนอกเครื่องหรือไม่จาก URL: เครือข่ายภายใน = ไม่ออก, อินเทอร์เน็ต = ออก", () => {
    const custom = BROWSER_PROVIDERS[2]!;
    expect(isExternal(BROWSER_PROVIDERS[0]!, LOCAL())).toBe(false);
    expect(isExternal(custom, { provider: custom.id, baseUrl: "http://192.168.1.10:8000/v1" })).toBe(false);
    expect(isExternal(custom, { provider: custom.id, baseUrl: "http://10.0.0.5/v1" })).toBe(false);
    expect(isExternal(custom, { provider: custom.id, baseUrl: "https://llm.example.com/v1" })).toBe(true);
    expect(isLocalUrl("http://localhost:11434/v1")).toBe(true);
    expect(isLocalUrl("http://172.20.0.2/v1")).toBe(true);
    expect(isLocalUrl("http://172.40.0.2/v1")).toBe(false);
  });
});

describe("ครบวงจรกับเซิร์ฟเวอร์จำลอง: ดึงข้อมูล → ร่าง → แก้", () => {
  it("เรียกตรงจากเบราว์เซอร์ (มี Origin) ได้ผลลัพธ์รูปแบบเดียวกับ API ของเซิร์ฟเวอร์", async () => {
    const f = await aiFacts({ type: "memo", request: "ขออนุมัติ เรียนผู้อำนวยการกองคลัง", profile: PROFILE, options: {}, llm: LOCAL() });
    expect(f.facts.recipient).toBe("ผู้อำนวยการกองคลัง");
    expect(f.missing).toEqual([]);
    expect(f.masked).toBe("");

    const d = await aiDraft({ type: "memo", request: "ขออนุมัติ", facts: f.facts, profile: PROFILE, options: { speed: "ด่วน" }, llm: LOCAL() });
    expect(d.file.type).toBe("memo");
    expect(d.file.options.speed).toBe("ด่วน");

    seen.length = 0;
    const r = await aiRevise({ file: d.file, instruction: "กระชับขึ้น", profile: PROFILE, llm: LOCAL() });
    expect(r.file.options.speed).toBe("ด่วน");
    expect(chats()).toHaveLength(1);
    expect(chats()[0]!.body!.model).toBe("qwen3.5:9b");
  });

  it("ขั้นแรกส่ง schema ที่ปิดแล้ว (ทุก field required) ไปให้ AI", async () => {
    await aiFacts({ type: "memo", request: "x", profile: PROFILE, options: {}, llm: LOCAL() });
    const fmt = chats()[0]!.body!.response_format as unknown as { json_schema: { schema: { additionalProperties: boolean; required: string[]; properties: object } } };
    expect(fmt.json_schema.schema.additionalProperties).toBe(false);
    expect(fmt.json_schema.schema.required).toEqual(Object.keys(fmt.json_schema.schema.properties));
  });

  it("เอกสารชั้นความลับใช้กับ AI ในเครื่องได้ — ไม่ปิดบังข้อมูลเพราะไม่ออกนอกเครื่อง", async () => {
    const request = "เรื่องลับ ขอเชิญนายสมชาย ใจดี โทร 081-234-5678";
    const d = await aiDraft({ type: "memo", request, facts: { recipient: "ผู้อำนวยการ" }, profile: PROFILE, options: { secrecy: "ลับ" }, llm: LOCAL() });
    expect(d.file.options.secrecy).toBe("ลับ");
    expect(d.masked).toBe("");
    expect(chats()[0]!.body!.messages.map((m) => m.content).join("")).toContain("081-234-5678");
  });
});

describe("เซิร์ฟเวอร์ AI ที่ระบุเอง บนอินเทอร์เน็ต (ถือว่าออกนอก)", () => {
  const remote = { provider: "browser-custom", model: "m", baseUrl: "https://llm.example.com/v1", apiKey: "sk-user-key" };
  const reply = (content: unknown) => async () => Response.json({ choices: [{ message: { content: JSON.stringify(content) } }] });

  it("หนังสือลับส่งไม่ได้ และไม่มีคำขอออกไปเลย", async () => {
    const fetchSpy = vi.fn(reply(memoWording));
    await expect(aiDraft({ type: "memo", request: "ลับ", facts: {}, profile: PROFILE, options: { secrecy: "ลับมาก" }, llm: remote }, undefined, { fetch: fetchSpy as unknown as typeof fetch })).rejects.toThrow(/ห้ามส่ง|ส่งให้ AI ภายนอก/);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("ปิดบังข้อมูลส่วนบุคคลก่อนส่ง แล้วคืนค่าจริง และส่ง key ไปยังเซิร์ฟเวอร์ AI โดยตรง", async () => {
    const bodies: string[] = [];
    const headers: Record<string, string>[] = [];
    const fetchSpy = vi.fn(async (_u: string, init: RequestInit) => {
      bodies.push(String(init.body));
      headers.push(init.headers as Record<string, string>);
      return Response.json({ choices: [{ message: { content: JSON.stringify({ body: ["หนังสือฉบับนี้ให้ไว้เพื่อรับรองว่า ⟦ชื่อ1⟧ เป็นพนักงาน"] }) } }] });
    });
    const d = await aiDraft(
      { type: "certificate", request: "รับรอง นางสาวสมหญิง ใจดี โทร 081-234-5678", facts: { personName: "นางสาวสมหญิง ใจดี" }, profile: PROFILE, options: {}, llm: remote },
      undefined,
      { fetch: fetchSpy as unknown as typeof fetch },
    );
    expect(bodies.join("")).not.toMatch(/สมหญิง|081-234/);
    expect((d.file.wording as { body: string[] }).body[0]).toContain("นางสาวสมหญิง ใจดี");
    expect(d.masked).toMatch(/ชื่อ 1/);
    expect(headers[0]!.Authorization).toBe("Bearer sk-user-key");
    expect(fetchSpy.mock.calls[0]![0]).toBe("https://llm.example.com/v1/chat/completions");
  });
});

describe("ยกเลิกและข้อผิดพลาด", () => {
  it("กดยกเลิกระหว่างรอ AI → หยุดทันที เป็น AbortError (ไม่ใช่ error ให้ผู้ใช้เห็น)", async () => {
    delayMs = 2000;
    const ctl = new AbortController();
    const p = aiFacts({ type: "memo", request: "x", profile: PROFILE, options: {}, llm: LOCAL() }, ctl.signal);
    setTimeout(() => ctl.abort(), 150);
    const t0 = Date.now();
    await expect(p).rejects.toMatchObject({ name: "AbortError" });
    expect(Date.now() - t0).toBeLessThan(1500);
  });

  it("เชื่อมต่อไม่ได้ → ข้อความบอกวิธีตั้งค่า (OLLAMA_ORIGINS, สิทธิ์เครือข่ายภายใน)", async () => {
    const err = await aiFacts({ type: "memo", request: "x", profile: PROFILE, options: {}, llm: { provider: "browser-ollama", model: "m", baseUrl: "http://127.0.0.1:1/v1" } }).catch((e: Error) => e);
    expect((err as Error).message).toContain("OLLAMA_ORIGINS");
    expect((err as Error).message).toContain("เครือข่ายภายใน");
    expect((err as Error).message).toContain("http://127.0.0.1:1/v1");
  });

  it("ไม่ระบุโมเดล/URL → บอกตรง ๆ ไม่ยิงคำขอ", async () => {
    await expect(aiFacts({ type: "memo", request: "x", profile: PROFILE, options: {}, llm: { provider: "browser-ollama", baseUrl: base } })).rejects.toThrow("ต้องระบุชื่อโมเดล");
    await expect(aiFacts({ type: "memo", request: "x", profile: PROFILE, options: {}, llm: { provider: "browser-custom", model: "m" } })).rejects.toThrow("ต้องระบุ URL");
    expect(seen).toHaveLength(0);
  });
});

describe("ตรวจการเชื่อมต่อ", () => {
  it("listModels คืนรายชื่อโมเดล", async () => {
    expect(await listModels(base)).toEqual(["qwen3.5:9b", "gemma3:12b"]);
  });

  it("เซิร์ฟเวอร์ตอบผิด → โยน error", async () => {
    await expect(listModels(base.replace("/v1", "/nope"))).rejects.toThrow();
  });
});

describe("ผู้ให้บริการอื่นยังไปทางเซิร์ฟเวอร์ THdocs เหมือนเดิม", () => {
  it("anthropic → POST /api/facts พร้อมตัวเลือกของผู้ใช้ และไม่แตะ AI ในเครื่อง", async () => {
    const calls: { url: string; body: Record<string, unknown> }[] = [];
    vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
      calls.push({ url, body: JSON.parse(String(init.body)) });
      return Response.json({ facts: { recipient: "x" }, missing: [], masked: "" });
    });
    const llm = { provider: "anthropic", apiKey: "sk-test" };
    const r = await aiFacts({ type: "memo", request: "x", profile: PROFILE, options: {}, llm });
    expect(r.facts.recipient).toBe("x");
    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toBe("/api/facts");
    expect(calls[0]!.body.llm).toEqual(llm);
    expect(seen).toHaveLength(0);
  });
});
