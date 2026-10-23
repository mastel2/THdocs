/**
 * ปิดบังข้อมูลส่วนบุคคลก่อนส่งให้ AI ภายนอก แล้วคืนค่าจริงในคำตอบ
 *
 * ข้อมูลจริงถูกแทนด้วยรหัส เช่น ⟦ชื่อ1⟧ ⟦โทร2⟧ — ค่าเดิมเดียวกันได้รหัสเดิมเสมอ
 * ชื่อบุคคลจับจากคำนำหน้า (นาย นาง นางสาว ดร. ฯลฯ) + ชื่อ + นามสกุล
 * เลือกปิดเกินดีกว่าปิดขาด: ค่าที่ปิดเกินถูกคืนกลับครบ ผลเสียมีแค่ AI เห็นบริบทน้อยลง
 */

export type PiiKind = "เลขบัตร" | "บัญชี" | "โทร" | "อีเมล" | "ชื่อ";

export interface MaskedItem {
  token: string;
  kind: PiiKind;
  value: string;
}

const D = "[0-9๐-๙]";
const SEP = "[- ]?";
const NOT_D = `(?<!${D})`;
const END_D = `(?!${D})`;

/** คำที่ขึ้นต้นด้วย "นาย/นาง" แต่เป็นตำแหน่ง ไม่ใช่ชื่อคน */
const TITLE_WORDS = "ก(?:รัฐมนตรี|เทศมนตรี|สมาคม|องค์การ|อบต|อบจ)|อำเภอ|ทะเบียน|ช่าง|สิบ|ร้อย|พัน|พล|ตรวจ|ประกัน|หน้า|งาน|จ้าง|ด่าน|ท้าย|พยาบาล|ฟ้า|ใน";
const PREFIX =
  `(?:ว่าที่\\s?ร้อยตรี|ว่าที่\\s?ร\\.ต\\.|เด็กชาย|เด็กหญิง|นางสาว|น\\.ส\\.|ด\\.ช\\.|ด\\.ญ\\.|นายแพทย์|แพทย์หญิง|นพ\\.|พญ\\.|ดร\\.|ผศ\\.|รศ\\.|ศ\\.|` +
  `นาย(?!${TITLE_WORDS})|นาง(?!สาว|${TITLE_WORDS}))`;
const NAME = "[ก-๏]{2,30}";

const PATTERNS: [PiiKind, RegExp][] = [
  ["อีเมล", /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g],
  ["เลขบัตร", new RegExp(`${NOT_D}${D}${SEP}${D}{4}${SEP}${D}{5}${SEP}${D}{2}${SEP}${D}${END_D}`, "g")],
  ["บัญชี", new RegExp(`${NOT_D}${D}{3}-${D}-${D}{5}-${D}${END_D}|(?<=บัญชี(?:เลขที่)?\\s*:?\\s*)${D}(?:${SEP}${D}){8,13}${END_D}`, "g")],
  ["โทร", new RegExp(`${NOT_D}(?:\\+66${SEP}|0|๐)(?:${SEP}${D}){8,9}${END_D}`, "g")],
  ["ชื่อ", new RegExp(`${PREFIX}\\s?${NAME}(?:\\s+${NAME})?`, "g")],
];

const TOKEN_RE = /[⟦[]{1,2}\s*(เลขบัตร|บัญชี|โทร|อีเมล|ชื่อ)\s*([0-9๐-๙]+)\s*[⟧\]]{1,2}/g;
const toArabic = (s: string) => s.replace(/[๐-๙]/g, (d) => String("๐๑๒๓๔๕๖๗๘๙".indexOf(d)));

export class PiiMasker {
  readonly items: MaskedItem[] = [];
  private readonly byValue = new Map<string, string>();

  mask(text: string): string {
    let out = text;
    for (const [kind, re] of PATTERNS) out = out.replace(re, (v) => this.token(kind, v));
    return out;
  }

  private token(kind: PiiKind, value: string): string {
    const known = this.byValue.get(value);
    if (known) return known;
    const n = this.items.filter((i) => i.kind === kind).length + 1;
    const token = `⟦${kind}${n}⟧`;
    this.byValue.set(value, token);
    this.items.push({ token, kind, value });
    return token;
  }

  /** คืนค่าจริง — ทนรูปแบบที่ AI อาจเปลี่ยน เช่น เลขไทย ช่องว่าง หรือ [[...]] */
  unmask<T>(value: T): T {
    if (typeof value === "string") {
      return value.replace(TOKEN_RE, (m, kind: string, n: string) => {
        const hit = this.items.find((i) => i.token === `⟦${kind}${toArabic(n)}⟧`);
        return hit ? hit.value : m;
      }) as T;
    }
    if (Array.isArray(value)) return value.map((v) => this.unmask(v)) as T;
    if (value && typeof value === "object") {
      return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, this.unmask(v)])) as T;
    }
    return value;
  }
}

/** สรุปให้ผู้ใช้เห็น เช่น "ชื่อ 2, โทร 1" — ไม่ส่งค่าจริงกลับ */
export function maskSummary(items: MaskedItem[]): string {
  const n = new Map<PiiKind, number>();
  for (const i of items) n.set(i.kind, (n.get(i.kind) ?? 0) + 1);
  return [...n].map(([k, c]) => `${k} ${c}`).join(", ");
}

export const MASK_NOTE =
  "ข้อความในวงเล็บ ⟦...⟧ เช่น ⟦ชื่อ1⟧ ⟦โทร1⟧ คือข้อมูลส่วนบุคคลที่ถูกปิดบัง ให้คัดลอกไปใช้ตามเดิมทุกตัวอักษร ห้ามแก้ ห้ามแปล ห้ามเดาค่าจริง";
