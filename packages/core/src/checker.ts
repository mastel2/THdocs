import type { Context, DocTypeDef, Finding } from "./doctype";
import { PLACEHOLDER_RE, findPlaceholders } from "./thai";

/** คำที่เป็นภาษาพูด/ไม่เหมาะกับเอกสารทางการ → คำแนะนำ */
const INFORMAL: Record<string, string> = {
  "ครับ": "ตัดคำลงท้ายภาษาพูดออก",
  "ค่ะ": "ตัดคำลงท้ายภาษาพูดออก",
  "นะคะ": "ตัดคำลงท้ายภาษาพูดออก",
  "เยอะ": "ใช้ 'จำนวนมาก'",
  "อยากจะ": "ใช้ 'มีความประสงค์จะ'",
  "ได้มั้ย": "ใช้ 'ได้หรือไม่'",
  "เลยขอ": "ใช้ 'จึงขอ'",
  "แค่": "ใช้ 'เพียง'",
};

/** เดินทุก field ที่เป็นข้อความ คืน path → ข้อความ */
export function textFields(value: unknown, prefix = ""): [string, string][] {
  if (typeof value === "string") return [[prefix, value]];
  if (Array.isArray(value)) return value.flatMap((v, i) => textFields(v, `${prefix}[${i}]`));
  if (value && typeof value === "object") {
    return Object.entries(value).flatMap(([k, v]) => textFields(v, prefix ? `${prefix}.${k}` : k));
  }
  return [];
}

const SEGMENTER = new Intl.Segmenter("th", { granularity: "word" });

/** ภาษาไทยไม่เว้นวรรคระหว่างคำ — ตัดคำด้วย ICU แล้วหาวลีจากคำที่ติดกัน ไม่จับคำที่เป็นส่วนของคำอื่น */
export function hasThaiPhrase(text: string, phrase: string): boolean {
  if (!text.includes(phrase)) return false;
  const words = [...SEGMENTER.segment(text)].map((s) => s.segment);
  for (let i = 0; i < words.length; i++) {
    let joined = "";
    for (let j = i; j < words.length && joined.length < phrase.length; j++) {
      joined += words[j];
      if (joined === phrase) return true;
    }
  }
  return false;
}

/** เศษจากโมเดลที่ตอบผิดรูป: วงเล็บ/เครื่องหมายแบบ JSON หรือคำแบบ kebab-case เช่น "details-in-sentence" */
const DEBRIS = /[{}[\]⟦⟧]|"\s*:|\b[a-z]+(?:-[a-z]+){1,}\b/; // ⟦⟧ = รหัสปิดบังที่ AI ทำเพี้ยนจนคืนค่าไม่ได้

function debris(text: string): boolean {
  if (/@|https?:\/\//.test(text)) return false;
  return DEBRIS.test(text.replace(PLACEHOLDER_RE, ""));
}

export function genericRules(doc: unknown): Finding[] {
  const out: Finding[] = [];
  for (const [where, text] of textFields(doc)) {
    if (debris(text)) {
      out.push({ level: "error", rule: "AI_DEBRIS", message: "พบข้อความแปลกปลอม AI อาจตอบผิดรูป — ตรวจและแก้ย่อหน้านี้", where });
    } else if (text.length > 0 && !/^\s*[-–—]\s*$/.test(text) && text.replace(/[\s.,:;-]/g, "").length < 2) {
      // "-" เดี่ยว ๆ = ตั้งใจว่า "ไม่มี/ไม่เกี่ยว" (ใช้บ่อยในช่องตาราง) ไม่ใช่เศษจาก AI
      out.push({ level: "error", rule: "AI_EMPTY", message: "ย่อหน้าว่างหรือสั้นผิดปกติ — ลบหรือเขียนใหม่", where });
    }
    const phs = [...new Set(findPlaceholders(text))];
    if (phs.length) out.push({ level: "warning", rule: "PLACEHOLDER", message: `ยังไม่ได้กรอก ${phs.join(", ")}`, where });
    for (const [word, fix] of Object.entries(INFORMAL)) {
      if (hasThaiPhrase(text, word)) out.push({ level: "warning", rule: "INFORMAL", message: `พบคำ '${word}' — ${fix}`, where });
    }
  }
  return out;
}

export function check<D>(def: DocTypeDef<unknown, D>, doc: D, ctx: Context): Finding[] {
  return [...def.rules.flatMap((r) => r(doc, ctx)), ...genericRules(doc)];
}

export function summarize(findings: Finding[]) {
  const n = (l: Finding["level"]) => findings.filter((f) => f.level === l).length;
  return { errors: n("error"), warnings: n("warning"), infos: n("info"), findings };
}
