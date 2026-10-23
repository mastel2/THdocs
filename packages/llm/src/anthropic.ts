import Anthropic from "@anthropic-ai/sdk";
import type { LLM, LLMRequest } from "@thdocs/core";
import { LLMError } from "./errors";

export interface AnthropicOptions {
  model?: string;
  apiKey?: string;
  effort?: "low" | "medium" | "high" | "xhigh" | "max";
}

/** Claude ผ่าน Anthropic SDK — structured output (output_config.format) ตอบตรง schema โดยไม่ต้องซ่อม JSON */
export class AnthropicLLM implements LLM {
  readonly id = "anthropic";
  readonly external = true;
  readonly model: string;
  private readonly client: Anthropic;
  private readonly effort: NonNullable<AnthropicOptions["effort"]>;

  constructor(opts: AnthropicOptions = {}) {
    this.model = opts.model ?? "claude-opus-5-5";
    this.effort = opts.effort ?? "medium";
    this.client = new Anthropic(opts.apiKey ? { apiKey: opts.apiKey } : {});
  }

  async generateJson(req: LLMRequest): Promise<unknown> {
    let res;
    try {
      res = await this.client.beta.messages.create({
        model: this.model,
        max_tokens: 16000,
        system: req.system,
        messages: [{ role: "user", content: req.user }],
        output_config: { effort: this.effort, format: { type: "json_schema", schema: req.schema } },
        // ถ้าตัวกรองความปลอดภัยปฏิเสธ ให้เซิร์ฟเวอร์ลองโมเดลสำรองที่ Anthropic แนะนำให้อัตโนมัติ
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
      });
    } catch (e) {
      if (e instanceof Anthropic.AuthenticationError) throw new LLMError("anthropic: API key ไม่ถูกต้อง (ANTHROPIC_API_KEY)", { cause: e });
      if (e instanceof Anthropic.RateLimitError) throw new LLMError("anthropic: เกินโควตา ลองใหม่ภายหลัง", { cause: e });
      if (e instanceof Anthropic.APIConnectionError) throw new LLMError("anthropic: เชื่อมต่อไม่ได้", { cause: e });
      if (e instanceof Anthropic.APIError) throw new LLMError(`anthropic: ${e.status} ${e.message}`, { cause: e });
      throw e;
    }
    if (res.stop_reason === "refusal") throw new LLMError("anthropic: คำขอถูกปฏิเสธโดยระบบความปลอดภัย");
    if (res.stop_reason === "max_tokens") throw new LLMError("anthropic: คำตอบยาวเกิน max_tokens");
    const text = res.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
    try {
      return JSON.parse(text);
    } catch {
      throw new LLMError("anthropic: คำตอบไม่ใช่ JSON");
    }
  }
}
