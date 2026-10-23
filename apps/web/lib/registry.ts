import type { DocTypeDef, TemplatePack } from "@thdocs/core";
import { isoPack } from "@thdocs/templates-iso";
import { thGovPack } from "@thdocs/templates-thgov";

export const PACKS: TemplatePack[] = [thGovPack, isoPack];
export const TYPES: DocTypeDef<any, any>[] = PACKS.flatMap((p) => p.types);
export const findType = (id: string) => TYPES.find((t) => t.id === id);

export interface ProviderInfo {
  id: string;
  name: string;
  /** ข้อมูลออกนอกเครื่อง/เครือข่ายผู้ใช้ */
  external: boolean;
  /** ผู้ใช้ต้องใส่ API key เอง (เซิร์ฟเวอร์ไม่มีให้) */
  needsKey: boolean;
  /** ต้องระบุชื่อโมเดล */
  needsModel: boolean;
  defaultModel?: string;
  /** custom: ผู้ใช้ระบุ base URL */
  needsUrl?: boolean;
  /** ทำงานในเบราว์เซอร์ของผู้ใช้ (เรียก AI ตรงจากเครื่องผู้ใช้ ไม่ผ่านเซิร์ฟเวอร์ THdocs) */
  browserSide?: boolean;
  /** URL ตั้งต้นของผู้ให้บริการที่ทำงานในเบราว์เซอร์ */
  defaultUrl?: string;
}

/**
 * ผู้ให้บริการที่รันในเบราว์เซอร์: เนื้อหาเอกสารไม่ผ่านเซิร์ฟเวอร์ THdocs เลย
 * (ไม่ใช่รายการจาก /api/config — มีเสมอ แม้เซิร์ฟเวอร์ออฟไลน์/ใช้แอปที่ติดตั้งไว้)
 */
export const BROWSER_PROVIDERS: ProviderInfo[] = [
  { id: "browser-ollama", name: "Ollama ในเครื่องคุณ", external: false, needsKey: false, needsModel: true, browserSide: true, defaultUrl: "http://localhost:11434/v1" },
  { id: "browser-lmstudio", name: "LM Studio ในเครื่องคุณ", external: false, needsKey: false, needsModel: true, browserSide: true, defaultUrl: "http://localhost:1234/v1" },
  // external ตัดสินตอนใช้จาก URL (เครือข่ายภายใน = ไม่ออกนอก) — ค่านี้เป็นค่าตั้งต้นแบบระวัง
  { id: "browser-custom", name: "เซิร์ฟเวอร์ AI ที่ระบุเอง (OpenAI-compatible)", external: true, needsKey: false, needsModel: true, browserSide: true, defaultUrl: "" },
];

/** ค่าที่ผู้ใช้ส่งมาเพื่อเลือก AI — API key ใช้เฉพาะคำขอนี้ ไม่เก็บที่เซิร์ฟเวอร์ */
export interface LLMChoice {
  provider: string;
  model?: string;
  apiKey?: string;
  baseUrl?: string;
}
