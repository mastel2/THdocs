import type { LLM, LLMRequest } from "@thdocs/core";
import { AnthropicLLM } from "./anthropic";
import { LLMError } from "./errors";
import { OpenAICompatLLM } from "./openai-compat";

export { AnthropicLLM, LLMError, OpenAICompatLLM };
export { parseJson } from "./openai-compat";

/** ผู้ให้บริการที่รู้จัก — ตัวที่เป็น OpenAI-compatible ใช้ OpenAICompatLLM */
const PRESETS = {
  openai: { baseUrl: "https://api.openai.com/v1", keyEnv: "OPENAI_API_KEY", external: true },
  gemini: { baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai", keyEnv: "GEMINI_API_KEY", external: true },
  ollama: { baseUrl: "http://localhost:11434/v1", keyEnv: "", external: false },
  lmstudio: { baseUrl: "http://localhost:1234/v1", keyEnv: "", external: false },
} as const;

export const PROVIDERS = ["anthropic", ...Object.keys(PRESETS), "custom"] as const;

export interface ProviderConfig {
  provider: string;
  model?: string;
  baseUrl?: string;
  apiKey?: string;
  /** custom: ข้อมูลออกนอกเครือข่ายหรือไม่ (ค่าเริ่มต้น true เพื่อความปลอดภัย) */
  external?: boolean;
}

export function createLLM(cfg: ProviderConfig, env: Record<string, string | undefined> = process.env): LLM {
  const model = cfg.model || env.THDOCS_LLM_MODEL || undefined;
  if (cfg.provider === "anthropic") {
    return new AnthropicLLM({ ...(model ? { model } : {}), ...(cfg.apiKey ? { apiKey: cfg.apiKey } : {}) });
  }
  if (!model) throw new LLMError(`ต้องระบุชื่อโมเดลสำหรับ ${cfg.provider} (--model หรือ THDOCS_LLM_MODEL)`);
  if (cfg.provider === "custom") {
    const baseUrl = cfg.baseUrl || env.THDOCS_LLM_BASE_URL;
    if (!baseUrl) throw new LLMError("custom ต้องระบุ --base-url หรือ THDOCS_LLM_BASE_URL");
    const apiKey = cfg.apiKey || env.THDOCS_LLM_API_KEY;
    return new OpenAICompatLLM({ id: "custom", baseUrl, model, ...(apiKey ? { apiKey } : {}), external: cfg.external ?? !isLocal(baseUrl) });
  }
  const preset = PRESETS[cfg.provider as keyof typeof PRESETS];
  if (!preset) throw new LLMError(`ไม่รู้จักผู้ให้บริการ '${cfg.provider}' (${PROVIDERS.join(" | ")})`);
  const apiKey = cfg.apiKey || (preset.keyEnv ? env[preset.keyEnv] : undefined);
  if (preset.keyEnv && !apiKey) throw new LLMError(`${cfg.provider} ต้องตั้ง ${preset.keyEnv}`);
  return new OpenAICompatLLM({
    id: cfg.provider,
    baseUrl: cfg.baseUrl || preset.baseUrl,
    model,
    ...(apiKey ? { apiKey } : {}),
    external: preset.external,
  });
}

function isLocal(url: string): boolean {
  try {
    const h = new URL(url).hostname;
    return h === "localhost" || h === "127.0.0.1" || h === "::1" || /^(10|192\.168|172\.(1[6-9]|2\d|3[01]))\./.test(h);
  } catch {
    return false;
  }
}

/** สำหรับทดสอบ: คืนคำตอบที่กำหนดไว้ตามลำดับ และเก็บคำขอทุกครั้ง */
export class MockLLM implements LLM {
  readonly id = "mock";
  readonly model = "mock";
  readonly calls: LLMRequest[] = [];
  constructor(private readonly responses: unknown[], readonly external = false) {}
  async generateJson(req: LLMRequest): Promise<unknown> {
    this.calls.push(req);
    if (!this.responses.length) throw new LLMError("mock: ไม่มีคำตอบเหลือ");
    return this.responses.shift();
  }
}
