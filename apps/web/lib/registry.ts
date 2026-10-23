import type { DocTypeDef, TemplatePack } from "@thdocs/core";
import { thGovPack } from "@thdocs/templates-thgov";

export const PACKS: TemplatePack[] = [thGovPack];
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
}

/** ค่าที่ผู้ใช้ส่งมาเพื่อเลือก AI — API key ใช้เฉพาะคำขอนี้ ไม่เก็บที่เซิร์ฟเวอร์ */
export interface LLMChoice {
  provider: string;
  model?: string;
  apiKey?: string;
  baseUrl?: string;
}
