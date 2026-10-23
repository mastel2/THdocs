/**
 * ลำดับงาน: ดึงข้อเท็จจริงจากคำขอ → ถามสิ่งที่ขาด → AI เขียนถ้อยคำ → ระบบประกอบเอกสาร → ตรวจ
 *
 * ไฟล์ร่าง (DraftFile) เก็บ facts กับ wording แยกกัน แล้วประกอบใหม่ทุกครั้งที่แสดงผล
 * การสั่งแก้จึงแก้ได้เฉพาะถ้อยคำ — ชั้นความลับ เลขที่ วันที่ ผู้ลงนาม ไม่หลุดหายเพราะ AI
 */
import { z } from "zod";
import type { Context, DocTypeDef, DraftOptions, FactSpec, Facts } from "./doctype";

export interface LLMRequest {
  system: string;
  user: string;
  /** JSON Schema (ได้จาก toLLMSchema) */
  schema: Record<string, unknown>;
  schemaName: string;
}

export interface LLM {
  readonly id: string;
  readonly model: string;
  /** true = ข้อมูลออกนอกเครื่อง/เครือข่ายของผู้ใช้ */
  readonly external: boolean;
  generateJson(req: LLMRequest): Promise<unknown>;
}

export class ConfidentialError extends Error {}

export interface DraftFile {
  thdocs: 1;
  type: string;
  facts: Facts;
  wording: unknown;
  options: Omit<DraftOptions, "date"> & { date?: string };
}

/** zod → JSON Schema ที่ผู้ให้บริการ structured output รับได้ (object ปิด, ทุก field required) */
export function toLLMSchema(schema: z.ZodType): Record<string, unknown> {
  const js = z.toJSONSchema(schema, { io: "output" }) as Record<string, unknown>;
  delete js.$schema;
  const close = (node: unknown): void => {
    if (!node || typeof node !== "object") return;
    const n = node as Record<string, unknown>;
    if (n.type === "object" && n.properties) {
      n.additionalProperties = false;
      n.required = Object.keys(n.properties as object);
    }
    Object.values(n).forEach((v) => (Array.isArray(v) ? v.forEach(close) : close(v)));
  };
  close(js);
  return js;
}

function guard(llm: LLM, ctx: Context) {
  if (ctx.options.secrecy && llm.external) {
    throw new ConfidentialError(
      `เอกสารชั้นความลับ '${ctx.options.secrecy}' ส่งให้ AI ภายนอก (${llm.id}) ไม่ได้ — ใช้ local LLM เช่น ollama`,
    );
  }
}

const json = (v: unknown) => JSON.stringify(v, null, 1);

export async function extractFacts(llm: LLM, def: DocTypeDef, request: string, ctx: Context, known: Facts = {}) {
  guard(llm, ctx);
  const shape = Object.fromEntries(def.facts.map((f) => [f.key, z.string().nullable()]));
  const schema = z.object(shape);
  const system = [
    `คุณช่วยเตรียมข้อมูลสำหรับร่าง "${def.name}"`,
    "อ่านคำขอของผู้ใช้ แล้วดึงข้อมูลตามรายการ field ด้านล่าง",
    "ตอบเฉพาะสิ่งที่ผู้ใช้บอกไว้จริง ถ้าไม่มีในคำขอให้ตอบ null — ห้ามเดาหรือแต่งข้อมูลเพิ่ม",
    "field:",
    ...def.facts.map((f) => `- ${f.key}: ${f.question}${f.example ? ` (เช่น ${f.example})` : ""}`),
  ].join("\n");
  const raw = await llm.generateJson({ system, user: request, schema: toLLMSchema(schema), schemaName: "facts" });
  // เก็บทีละ field — โมเดลเล็กอาจตอบไม่ครบทุก key ก็ยังใช้ส่วนที่ได้
  const got = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const extracted = Object.fromEntries(def.facts.map((f) => [f.key, typeof got[f.key] === "string" ? (got[f.key] as string) : null]));
  const facts: Facts = { ...extracted, ...dropEmpty(known) };
  return { facts, missing: missingFacts(def, facts) };
}

export function missingFacts(def: DocTypeDef, facts: Facts): FactSpec[] {
  return def.facts.filter((f) => f.required && !facts[f.key]?.trim());
}

function dropEmpty(f: Facts): Facts {
  return Object.fromEntries(Object.entries(f).filter(([, v]) => v != null && v.trim() !== ""));
}

async function askWording<W>(llm: LLM, def: DocTypeDef<W>, system: string, user: string, repairs = 1): Promise<W> {
  const schema = toLLMSchema(def.wordingSchema);
  let msg = user;
  for (let attempt = 0; ; attempt++) {
    const raw = await llm.generateJson({ system, user: msg, schema, schemaName: def.id });
    const r = def.wordingSchema.safeParse(raw);
    if (r.success) return r.data;
    if (attempt >= repairs) throw new Error(`AI ตอบไม่ตรงโครงสร้าง: ${z.prettifyError(r.error)}`);
    msg = `${user}\n\nคำตอบก่อนหน้าไม่ตรงโครงสร้าง:\n${z.prettifyError(r.error)}\nคำตอบเดิม: ${JSON.stringify(raw).slice(0, 4000)}\nตอบใหม่ทั้งก้อนให้ตรงโครงสร้าง`;
  }
}

const BASE_RULES = [
  "เขียนด้วยภาษาราชการที่สุภาพ กระชับ ชัดเจน",
  "ใช้เฉพาะข้อเท็จจริงที่ได้รับ ข้อมูลใดไม่มีให้ใส่ [ระบุ: <สิ่งที่ต้องกรอก>] ห้ามเดา ชื่อคน วันที่ ตัวเลข หรือเลขที่หนังสือ",
  "ไม่ต้องเขียนส่วนที่ระบบเติมเอง (ผู้รับ เลขที่ วันที่ ที่อยู่ ผู้ลงนาม คำขึ้นต้น/ลงท้าย) เว้นแต่ field ระบุให้เขียน",
  "แต่ละย่อหน้าเป็นประโยคสมบูรณ์ที่อ่านต่อเนื่อง รวมรายละเอียด (วัน เวลา สถานที่ จำนวน งบประมาณ) ไว้ในประโยค ไม่แยกเป็นข้อสั้น ๆ ทีละบรรทัด",
];

export async function draft<W>(llm: LLM, def: DocTypeDef<W>, request: string, facts: Facts, ctx: Context): Promise<DraftFile> {
  guard(llm, ctx);
  const system = [...BASE_RULES, "", `ชนิดเอกสาร: ${def.name}`, def.guidance].join("\n");
  const user = `คำขอ: ${request}\n\nข้อเท็จจริง:\n${json(dropEmpty(facts))}\n\nหน่วยงาน: ${ctx.profile.orgName} / ${ctx.profile.unit}`;
  const wording = await askWording(llm, def, system, user);
  return toDraftFile(def, facts, wording, ctx);
}

export async function revise<W>(llm: LLM, def: DocTypeDef<W>, file: DraftFile, instruction: string, ctx: Context): Promise<DraftFile> {
  guard(llm, ctx);
  const system = [...BASE_RULES, "แก้ถ้อยคำตามคำสั่ง ส่วนที่ไม่ได้สั่งให้คงเดิม", "", `ชนิดเอกสาร: ${def.name}`, def.guidance].join("\n");
  const user = `ถ้อยคำปัจจุบัน:\n${json(file.wording)}\n\nข้อเท็จจริง:\n${json(dropEmpty(file.facts))}\n\nคำสั่งแก้ไข: ${instruction}`;
  const wording = await askWording(llm, def, system, user);
  return { ...file, wording };
}

export function toDraftFile(def: DocTypeDef, facts: Facts, wording: unknown, ctx: Context): DraftFile {
  const { date, ...rest } = ctx.options;
  return { thdocs: 1, type: def.id, facts, wording, options: { ...rest, ...(date ? { date: date.toISOString() } : {}) } };
}

/** ไฟล์ร่าง → เอกสารฉบับเต็ม (ตรวจ wording ด้วย schema ทุกครั้ง เพราะผู้ใช้แก้ไฟล์เองได้) */
export function assembleDraft<W, D>(def: DocTypeDef<W, D>, file: DraftFile, ctx: Context): D {
  const r = def.wordingSchema.safeParse(file.wording);
  if (!r.success) throw new Error(`ไฟล์ร่างไม่ตรงโครงสร้าง ${def.id}: ${z.prettifyError(r.error)}`);
  return def.assemble(r.data, file.facts, ctx);
}

export function contextFromDraft(file: DraftFile, profile: Context["profile"]): Context {
  const { date, ...rest } = file.options;
  return { profile, options: { ...rest, ...(date ? { date: new Date(date) } : {}) } };
}
