/**
 * ผู้ให้บริการที่มี API แบบ OpenAI Chat Completions: OpenAI, Gemini (endpoint OpenAI-compatible),
 * Ollama, LM Studio, vLLM และเซิร์ฟเวอร์อื่นที่เข้ากันได้
 *
 * ขอ structured output แบบ json_schema ก่อน ถ้า endpoint ไม่รองรับ (400/422) ลดเป็น json_object
 * แล้วใส่ schema ใน prompt แทน และแยก JSON จากคำตอบ (ตัด <think> และ ``` ออก)
 */
import type { LLM, LLMRequest } from "@thdocs/core";
import { LLMError } from "./errors";
export { LLMError };

export interface OpenAICompatOptions {
  id: string;
  baseUrl: string;
  model: string;
  apiKey?: string;
  /** true = ข้อมูลออกนอกเครื่อง/เครือข่ายของผู้ใช้ */
  external: boolean;
  timeoutMs?: number;
  fetch?: typeof fetch;
}

type Mode = "json_schema" | "json_object";

export class OpenAICompatLLM implements LLM {
  readonly id: string;
  readonly model: string;
  readonly external: boolean;
  private mode: Mode = "json_schema";

  constructor(private readonly opts: OpenAICompatOptions) {
    this.id = opts.id;
    this.model = opts.model;
    this.external = opts.external;
  }

  async generateJson(req: LLMRequest): Promise<unknown> {
    for (;;) {
      const res = await this.post(this.body(req, this.mode), req.signal);
      if ((res.status === 400 || res.status === 422) && this.mode === "json_schema") {
        this.mode = "json_object"; // จำไว้ ไม่ต้องลองซ้ำ
        continue;
      }
      if (res.status === 401 || res.status === 403) throw new LLMError(`${this.id}: API key ไม่ถูกต้องหรือไม่มีสิทธิ์`);
      if (!res.ok) throw new LLMError(`${this.id}: ${res.status} ${(await res.text()).slice(0, 300)}`);
      const data = (await res.json()) as { choices?: { message?: { content?: string | null } }[] };
      return parseJson(data.choices?.[0]?.message?.content ?? "", this.id);
    }
  }

  private body(req: LLMRequest, mode: Mode) {
    const system = mode === "json_schema"
      ? req.system
      : `${req.system}\n\nตอบเป็น JSON object เท่านั้น ตรงตาม JSON Schema นี้:\n${JSON.stringify(req.schema)}`;
    return {
      model: this.model,
      messages: [{ role: "system", content: system }, { role: "user", content: req.user }],
      response_format: mode === "json_schema"
        ? { type: "json_schema", json_schema: { name: req.schemaName.replace(/[^a-zA-Z0-9_-]/g, "_"), schema: req.schema, strict: true } }
        : { type: "json_object" },
    };
  }

  private async post(body: unknown, userSignal?: AbortSignal): Promise<Response> {
    const f = this.opts.fetch ?? fetch;
    const timeout = AbortSignal.timeout(this.opts.timeoutMs ?? 300_000);
    try {
      return await f(`${this.opts.baseUrl.replace(/\/$/, "")}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(this.opts.apiKey ? { Authorization: `Bearer ${this.opts.apiKey}` } : {}) },
        body: JSON.stringify(body),
        signal: userSignal ? AbortSignal.any([timeout, userSignal]) : timeout,
      });
    } catch (e) {
      // ผู้ใช้กดยกเลิก: ส่ง AbortError ต่อให้ชั้นบนเงียบ ไม่ใช่ error ว่าเชื่อมต่อไม่ได้
      if (userSignal?.aborted) throw userSignal.reason instanceof Error ? userSignal.reason : new DOMException("Aborted", "AbortError");
      throw new LLMError(`${this.id}: เชื่อมต่อ ${this.opts.baseUrl} ไม่ได้ (${(e as Error).message})`, { cause: e });
    }
  }
}

export function parseJson(text: string, source = "llm"): unknown {
  let t = text.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
  const fenced = /```(?:json)?\s*([\s\S]*?)```/.exec(t);
  if (fenced) t = fenced[1]!;
  const start = t.indexOf("{");
  const end = t.lastIndexOf("}");
  if (start < 0 || end < start) throw new LLMError(`${source}: ไม่พบ JSON ในคำตอบ`);
  try {
    return JSON.parse(t.slice(start, end + 1));
  } catch {
    throw new LLMError(`${source}: JSON ไม่สมบูรณ์`);
  }
}

/** รายชื่อโมเดลของเซิร์ฟเวอร์ที่พูด OpenAI API (Ollama, LM Studio, vLLM) — ใช้ตรวจการเชื่อมต่อด้วย */
export async function listModels(baseUrl: string, opts: { apiKey?: string; fetch?: typeof fetch; signal?: AbortSignal } = {}): Promise<string[]> {
  const f = opts.fetch ?? fetch;
  const timeout = AbortSignal.timeout(10_000);
  const res = await f(`${baseUrl.replace(/\/$/, "")}/models`, {
    headers: opts.apiKey ? { Authorization: `Bearer ${opts.apiKey}` } : {},
    signal: opts.signal ? AbortSignal.any([timeout, opts.signal]) : timeout,
  });
  if (!res.ok) throw new LLMError(`${baseUrl}: ${res.status}`);
  const data = (await res.json()) as { data?: { id?: string }[] };
  return (data.data ?? []).map((m) => m.id).filter((x): x is string => !!x);
}

/** URL ชี้ไปเครื่องตัวเองหรือเครือข่ายภายใน (localhost, 127.x, 10.x, 192.168.x, 172.16-31.x) */
export function isLocalUrl(url: string): boolean {
  try {
    const h = new URL(url).hostname;
    return h === "localhost" || h === "127.0.0.1" || h === "[::1]" || h === "::1" || /^(10|192\.168|172\.(1[6-9]|2\d|3[01]))\./.test(h);
  } catch {
    return false;
  }
}
