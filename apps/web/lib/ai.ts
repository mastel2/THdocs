"use client";
/**
 * ชั้นเรียก AI ฝั่งเบราว์เซอร์ — เลือกทางตามผู้ให้บริการที่ผู้ใช้เลือก
 *   - ผู้ให้บริการในเครื่อง (BROWSER_PROVIDERS): รันลำดับงานของ THdocs ในเบราว์เซอร์ แล้วเรียก AI ตรงจากเครื่องผู้ใช้
 *     เนื้อหาเอกสารไม่ผ่านเซิร์ฟเวอร์ THdocs เลย (ใช้กับเอกสารชั้นความลับได้ และใช้ออฟไลน์ได้เมื่อติดตั้งแอปแล้ว)
 *   - ผู้ให้บริการอื่น: เรียก API ของเซิร์ฟเวอร์เหมือนเดิม (นโยบาย key/SSRF/จำกัดอัตราอยู่ฝั่งเซิร์ฟเวอร์)
 * ผลลัพธ์รูปแบบเดียวกันทั้งสองทาง — ส่วนหน้าจอไม่ต้องรู้ว่าทำที่ไหน
 */
import {
  ConfidentialError,
  draft,
  extractFacts,
  maskSummary,
  normalizeProfile,
  revise,
  rewriteText,
  type Context,
  type DraftFile,
  type DraftOptions,
  type Facts,
  type LLM,
  type OrgProfile,
  type PrivacyAudit,
  type RewriteMode,
  type Secrecy,
} from "@thdocs/core";
import { LLMError, OpenAICompatLLM, isLocalUrl } from "@thdocs/llm/openai-compat";
import { api } from "./client";
import { BROWSER_PROVIDERS, findType, type LLMChoice, type ProviderInfo } from "./registry";

export interface Deps {
  /** แทน fetch ของเบราว์เซอร์ (ใช้ทดสอบ) */
  fetch?: typeof fetch;
}

/** ตัวเลือกเอกสารที่ส่งมาจากหน้าจอ (date เป็นข้อความ ISO) */
export type RawOptions = Omit<DraftOptions, "date"> & { date?: string };

export const browserProvider = (id: string): ProviderInfo | undefined => BROWSER_PROVIDERS.find((p) => p.id === id);

export function llmUrl(choice: LLMChoice): string {
  return choice.baseUrl?.trim() || browserProvider(choice.provider)?.defaultUrl || "";
}

/** ผู้ให้บริการนี้ส่งข้อมูลออกนอกเครื่อง/เครือข่ายผู้ใช้หรือไม่ (browser-custom ตัดสินจาก URL) */
export function isExternal(info: ProviderInfo, choice: LLMChoice): boolean {
  return info.id === "browser-custom" ? !isLocalUrl(llmUrl(choice)) : info.external;
}

const CONNECT_HINT = (url: string) => {
  const origin = typeof location !== "undefined" ? location.origin : "https://<โดเมนของเว็บนี้>";
  return (
    `เบราว์เซอร์เชื่อมต่อ ${url} ไม่ได้ — ตรวจว่า (1) เปิด AI ในเครื่องอยู่ ` +
    `(2) อนุญาตให้เว็บนี้เรียกได้: Ollama ตั้ง OLLAMA_ORIGINS=${origin} แล้วเริ่มใหม่ ` +
    `(3) ถ้าเบราว์เซอร์ถาม "เข้าถึงอุปกรณ์ในเครือข่ายภายใน" ให้กดอนุญาต`
  );
};

function browserLLM(choice: LLMChoice, info: ProviderInfo, signal?: AbortSignal, deps: Deps = {}): LLM {
  const baseUrl = llmUrl(choice);
  if (!baseUrl) throw new Error("ต้องระบุ URL ของเซิร์ฟเวอร์ AI");
  if (!choice.model?.trim()) throw new Error("ต้องระบุชื่อโมเดล");
  const external = isExternal(info, choice);
  const inner = new OpenAICompatLLM({
    id: info.id,
    baseUrl,
    model: choice.model.trim(),
    ...(choice.apiKey?.trim() ? { apiKey: choice.apiKey.trim() } : {}),
    external,
    ...(deps.fetch ? { fetch: deps.fetch } : {}),
  });
  return {
    id: inner.id,
    model: inner.model,
    external,
    generateJson: (req) => inner.generateJson({ ...req, ...(signal ? { signal } : {}) }),
  };
}

/** แปลง error ของการเชื่อมต่อให้เป็นคำแนะนำที่ทำตามได้ — error อื่น (เช่น หนังสือลับ) ส่งต่อตามเดิม */
function explain(e: unknown, url: string): never {
  if (e instanceof LLMError && e.message.includes("เชื่อมต่อ")) throw new Error(CONNECT_HINT(url), { cause: e });
  if (e instanceof ConfidentialError) throw new Error(e.message, { cause: e });
  throw e;
}

function context(profile: OrgProfile | undefined, options: RawOptions): Context {
  const { date, ...rest } = options;
  return { profile: normalizeProfile(profile ?? {}), options: { ...rest, ...(date ? { date: new Date(date) } : {}) } };
}

type FactsResult = { facts: Facts; missing: string[]; masked: string };
type FileResult = { file: DraftFile; masked: string };

export async function aiFacts(
  a: { type: string; request: string; profile: OrgProfile; options: RawOptions; known?: Facts; llm: LLMChoice },
  signal?: AbortSignal,
  deps: Deps = {},
): Promise<FactsResult> {
  const info = browserProvider(a.llm.provider);
  if (!info) return api<FactsResult>("/api/facts", { type: a.type, request: a.request, profile: a.profile, options: a.options, known: a.known ?? {}, llm: a.llm }, signal);
  const def = findType(a.type);
  if (!def) throw new Error(`ไม่รู้จักชนิดเอกสาร '${a.type}'`);
  const audit: PrivacyAudit = { masked: [] };
  try {
    const { facts, missing } = await extractFacts(browserLLM(a.llm, info, signal, deps), def, a.request, context(a.profile, a.options), a.known ?? {}, audit);
    return { facts, missing: missing.map((m) => m.key), masked: maskSummary(audit.masked) };
  } catch (e) {
    return explain(e, llmUrl(a.llm));
  }
}

export async function aiDraft(
  a: { type: string; request: string; facts: Facts; profile: OrgProfile; options: RawOptions; llm: LLMChoice },
  signal?: AbortSignal,
  deps: Deps = {},
): Promise<FileResult> {
  const info = browserProvider(a.llm.provider);
  if (!info) return api<FileResult>("/api/draft", { type: a.type, request: a.request, facts: a.facts, profile: a.profile, options: a.options, llm: a.llm }, signal);
  const def = findType(a.type);
  if (!def) throw new Error(`ไม่รู้จักชนิดเอกสาร '${a.type}'`);
  const audit: PrivacyAudit = { masked: [] };
  try {
    const file = await draft(browserLLM(a.llm, info, signal, deps), def, a.request, a.facts, context(a.profile, a.options), audit);
    return { file, masked: maskSummary(audit.masked) };
  } catch (e) {
    return explain(e, llmUrl(a.llm));
  }
}

export async function aiRevise(
  a: { file: DraftFile; instruction: string; profile: OrgProfile; llm: LLMChoice },
  signal?: AbortSignal,
  deps: Deps = {},
): Promise<FileResult> {
  const info = browserProvider(a.llm.provider);
  if (!info) return api<FileResult>("/api/revise", { file: a.file, instruction: a.instruction, profile: a.profile, llm: a.llm }, signal);
  const def = findType(a.file.type);
  if (!def) throw new Error(`ไม่รู้จักชนิดเอกสาร '${a.file.type}'`);
  const { date, ...rest } = a.file.options;
  const ctx: Context = { profile: normalizeProfile(a.profile), options: { ...rest, ...(date ? { date: new Date(date) } : {}) } };
  const audit: PrivacyAudit = { masked: [] };
  try {
    const file = await revise(browserLLM(a.llm, info, signal, deps), def, a.file, a.instruction, ctx, audit);
    return { file, masked: maskSummary(audit.masked) };
  } catch (e) {
    return explain(e, llmUrl(a.llm));
  }
}

export async function aiRewrite(
  a: { text: string; mode: RewriteMode; secrecy?: Secrecy; llm: LLMChoice },
  signal?: AbortSignal,
  deps: Deps = {},
): Promise<{ text: string; masked: string }> {
  const info = browserProvider(a.llm.provider);
  if (!info) return api<{ text: string; masked: string }>("/api/rewrite", { text: a.text, mode: a.mode, ...(a.secrecy ? { secrecy: a.secrecy } : {}), llm: a.llm }, signal);
  const audit: PrivacyAudit = { masked: [] };
  try {
    const text = await rewriteText(browserLLM(a.llm, info, signal, deps), a.text, a.mode, a.secrecy, audit);
    return { text, masked: maskSummary(audit.masked) };
  } catch (e) {
    return explain(e, llmUrl(a.llm));
  }
}
