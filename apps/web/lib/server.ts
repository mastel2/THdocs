/**
 * นโยบายฝั่งเซิร์ฟเวอร์ — เว็บสาธารณะต้องไม่:
 *   - ใช้ API key ของเซิร์ฟเวอร์แทนผู้ใช้ (เว้นแต่ THDOCS_SERVER_KEYS=1 สำหรับติดตั้งใช้เองภายใน)
 *   - ยิงไป URL ที่ผู้ใช้กำหนดเอง (SSRF) เว้นแต่ THDOCS_ALLOW_CUSTOM_URL=1
 *   - อ่านไฟล์บนเซิร์ฟเวอร์ตาม path ที่ผู้ใช้ส่งมา (ตราส่งมาเป็น data URL เท่านั้น)
 */
import { ConfidentialError, normalizeProfile, type DraftFile, type LLM, type OrgProfile } from "@thdocs/core";
import { LLMError, createLLM } from "@thdocs/llm";
import { z } from "zod";
import { findType, type LLMChoice, type ProviderInfo } from "./registry";

const env = process.env;
const DEV = env.NODE_ENV !== "production";
const serverKeys = env.THDOCS_SERVER_KEYS === "1";

/** ollama/lmstudio เปิดเมื่อกำหนด URL ไว้ หรือรันแบบพัฒนาในเครื่อง */
const LOCAL_URLS: Record<string, string | undefined> = {
  ollama: env.THDOCS_OLLAMA_URL || (DEV ? "http://localhost:11434/v1" : undefined),
  lmstudio: env.THDOCS_LMSTUDIO_URL || (DEV ? "http://localhost:1234/v1" : undefined),
};

const KEY_ENV: Record<string, string> = { anthropic: "ANTHROPIC_API_KEY", openai: "OPENAI_API_KEY", gemini: "GEMINI_API_KEY" };

export function providers(): ProviderInfo[] {
  const cloud = (id: string, name: string, defaultModel?: string): ProviderInfo => ({
    id,
    name,
    external: true,
    needsKey: !(serverKeys && env[KEY_ENV[id]!]),
    needsModel: !defaultModel,
    ...(defaultModel ? { defaultModel } : {}),
  });
  const list: ProviderInfo[] = [cloud("anthropic", "Claude (Anthropic)", "claude-opus-5-5"), cloud("openai", "OpenAI"), cloud("gemini", "Google Gemini")];
  if (LOCAL_URLS.ollama) list.push({ id: "ollama", name: "Ollama (ในเครื่อง)", external: false, needsKey: false, needsModel: true });
  if (LOCAL_URLS.lmstudio) list.push({ id: "lmstudio", name: "LM Studio (ในเครื่อง)", external: false, needsKey: false, needsModel: true });
  if (env.THDOCS_ALLOW_CUSTOM_URL === "1") {
    list.push({ id: "custom", name: "เซิร์ฟเวอร์ OpenAI-compatible", external: true, needsKey: false, needsModel: true, needsUrl: true });
  }
  return list;
}

export function llmFrom(choice: LLMChoice): LLM {
  const info = providers().find((p) => p.id === choice.provider);
  if (!info) throw new HttpError(400, `ไม่รองรับผู้ให้บริการ '${choice.provider}' บนเซิร์ฟเวอร์นี้`);
  const apiKey = choice.apiKey?.trim();
  if (info.needsKey && !apiKey) throw new HttpError(400, `ต้องใส่ API key ของ ${info.name}`);
  if (info.needsModel && !choice.model?.trim()) throw new HttpError(400, "ต้องระบุชื่อโมเดล");
  // ส่งต่อเฉพาะ key ที่อนุญาต — ไม่ปล่อย process.env ทั้งก้อนให้ createLLM
  const keyEnv = KEY_ENV[choice.provider];
  const allowedEnv: Record<string, string | undefined> = serverKeys && keyEnv && !apiKey ? { [keyEnv]: env[keyEnv] } : {};
  if (choice.provider === "anthropic" && !apiKey && !serverKeys) throw new HttpError(400, "ต้องใส่ API key ของ Claude");
  const baseUrl = choice.provider === "custom" ? choice.baseUrl : LOCAL_URLS[choice.provider];
  return createLLM(
    {
      provider: choice.provider,
      ...(choice.model?.trim() ? { model: choice.model.trim() } : {}),
      ...(apiKey ? { apiKey } : {}),
      ...(baseUrl ? { baseUrl } : {}),
    },
    allowedEnv,
  );
}

// ---------------------------------------------------------------- validation
export const ProfileSchema = z.object({
  orgName: z.string().max(300).default(""),
  unit: z.string().max(300).default(""),
  address: z.array(z.string().max(300)).max(8).default([]),
  phone: z.string().max(100).optional(),
  email: z.string().max(200).optional(),
  docNoPrefix: z.string().max(100).optional(),
  signer: z.object({ name: z.string().max(200), position: z.array(z.string().max(300)).max(6) }).optional(),
  unitLabel: z.string().max(50).optional(),
  // ระยะขอบที่หน่วยงานปรับ แยกตามชุดแม่แบบ — ค่าผิดปกติ marginsFor() ใช้ค่าตั้งต้นแทน
  margins: z.record(z.string().max(40), z.object({ topCm: z.number(), bottomCm: z.number(), leftCm: z.number(), rightCm: z.number(), headerCm: z.number() }).partial()).optional(),
}); // ไม่มี emblemPng: ห้ามรับ path จากผู้ใช้

export function profileFrom(raw: unknown): OrgProfile {
  return normalizeProfile(ProfileSchema.parse(raw ?? {}));
}

export const OptionsSchema = z.object({
  speed: z.enum(["ด่วนที่สุด", "ด่วนมาก", "ด่วน"]).optional(),
  secrecy: z.enum(["ลับที่สุด", "ลับมาก", "ลับ"]).optional(),
  date: z.iso.datetime().optional(),
  thaiDigits: z.boolean().optional(),
});

export const FactsSchema = z.record(z.string().max(100), z.string().max(4000).nullable());

export const DraftFileSchema = z.object({
  thdocs: z.literal(1),
  type: z.string(),
  facts: FactsSchema,
  wording: z.unknown(),
  options: OptionsSchema,
});

export function draftFileFrom(raw: unknown): DraftFile {
  const f = DraftFileSchema.parse(raw) as DraftFile;
  if (!findType(f.type)) throw new HttpError(400, `ไม่รู้จักชนิดเอกสาร '${f.type}'`);
  return f;
}

export const LLMChoiceSchema = z.object({
  provider: z.string().max(40),
  model: z.string().max(200).optional(),
  apiKey: z.string().max(400).optional(),
  baseUrl: z.url().max(400).optional(),
});

// ---------------------------------------------------------------- http
export class HttpError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

const MAX_BODY = 1_000_000; // รวมตรา data URL

export async function readJson(req: Request): Promise<unknown> {
  const text = await req.text();
  if (text.length > MAX_BODY) throw new HttpError(413, "คำขอใหญ่เกินไป");
  try {
    return JSON.parse(text);
  } catch {
    throw new HttpError(400, "JSON ไม่ถูกต้อง");
  }
}

/** จำกัดคำขอที่เรียก AI ต่อ IP (หน่วยความจำในโปรเซส — ขึ้นระบบจริงหลายเครื่องให้ย้ายไป Redis) */
const hits = new Map<string, { n: number; reset: number }>();
const WINDOW_MS = 10 * 60_000;
// ค่าว่างหรือไม่ใช่ตัวเลข (เช่น "THDOCS_RATE_LIMIT=" ในไฟล์ .env) ใช้ค่าตั้งต้น — ไม่ใช่ 0 ซึ่งจะปฏิเสธทุกคำขอ
const MAX_HITS = Number(env.THDOCS_RATE_LIMIT) > 0 ? Number(env.THDOCS_RATE_LIMIT) : 60;

/** ตารางไม่โตไม่จบ: เกินเพดานให้ล้างรายการที่หมดอายุก่อน ถ้ายังเต็มให้ล้างทั้งหมด (ยอมให้ผู้ใช้ได้โควตาใหม่ดีกว่าให้หน่วยความจำหมด) */
const MAX_TRACKED = 10_000;

export function rateLimit(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim().slice(0, 64) || "local";
  const now = Date.now();
  if (hits.size >= MAX_TRACKED) {
    for (const [k, v] of hits) if (v.reset < now) hits.delete(k);
    if (hits.size >= MAX_TRACKED) hits.clear();
  }
  const h = hits.get(ip);
  if (!h || h.reset < now) hits.set(ip, { n: 1, reset: now + WINDOW_MS });
  else if (++h.n > MAX_HITS) throw new HttpError(429, "เรียกใช้บ่อยเกินไป ลองใหม่ภายหลัง");
}

export function handle(fn: (req: Request) => Promise<Response>) {
  return async (req: Request) => {
    try {
      const res = await fn(req);
      // ผลลัพธ์มีเนื้อหาเอกสาร — ห้ามเบราว์เซอร์/พร็อกซีเก็บแคช
      res.headers.set("Cache-Control", "no-store");
      return res;
    } catch (e) {
      const [status, detail] =
        e instanceof HttpError ? [e.status, e.message]
        : e instanceof ConfidentialError ? [403, e.message]
        : e instanceof LLMError ? [502, e.message]
        : e instanceof z.ZodError ? [400, `ข้อมูลไม่ถูกต้อง: ${z.prettifyError(e)}`]
        : [500, "เกิดข้อผิดพลาดภายใน"];
      if (status === 500) console.error(e);
      return Response.json({ detail }, { status, headers: { "Cache-Control": "no-store" } });
    }
  };
}
