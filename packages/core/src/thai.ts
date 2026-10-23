/** เครื่องมือภาษาไทย: เลขไทย วันที่พุทธศักราช ช่องที่ยังไม่กรอก */

export const THAI_MONTHS = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
] as const;

const THAI_DIGITS = "๐๑๒๓๔๕๖๗๘๙";
const KEEP_ARABIC = /(https?:\/\/\S+|[\w.+-]+@[\w-]+(?:\.[\w-]+)+)/g;

export function toThaiDigits(text: string): string {
  // แยกส่วนที่ต้องคงเลขอารบิก (URL/อีเมล) ออกก่อน แล้วแปลงเฉพาะส่วนที่เหลือ
  return text
    .split(KEEP_ARABIC)
    .map((part, i) => (i % 2 === 1 ? part : part.replace(/[0-9]/g, (d) => THAI_DIGITS[Number(d)]!)))
    .join("");
}

export function toArabicDigits(text: string): string {
  return text.replace(/[๐-๙]/g, (d) => String(THAI_DIGITS.indexOf(d)));
}

/** "๒๓ ตุลาคม ๒๕๖๙" หรือ "๒๓ ตุลาคม พ.ศ. ๒๕๖๙" เมื่อ withBE */
export function thaiDate(d: Date, withBE = false): string {
  const y = d.getFullYear() + 543;
  return toThaiDigits(`${d.getDate()} ${THAI_MONTHS[d.getMonth()]} ${withBE ? "พ.ศ. " : ""}${y}`);
}

const DATE_RE = new RegExp(
  `^\\s*([0-9๐-๙]{1,2})\\s+(${THAI_MONTHS.join("|")})\\s+(?:พ\\.ศ\\.\\s*)?([0-9๐-๙]{4})\\s*$`,
);

export function parseThaiDate(text: string): { day: number; month: number; yearBE: number; hasBE: boolean } | null {
  const m = DATE_RE.exec(text);
  if (!m) return null;
  return {
    day: Number(toArabicDigits(m[1]!)),
    month: THAI_MONTHS.indexOf(m[2] as (typeof THAI_MONTHS)[number]) + 1,
    yearBE: Number(toArabicDigits(m[3]!)),
    hasBE: text.includes("พ.ศ."),
  };
}

const THAI_CHAR = /[฀-๿]/;
const WORDS = new Intl.Segmenter("th", { granularity: "word" });
export const ZWSP = "​";

/**
 * แทรก zero-width space ที่ขอบคำไทย ให้โปรแกรมตัดบรรทัดตรงขอบคำได้เสมอ
 * (Word บางสภาพแวดล้อมตัดเฉพาะที่ช่องว่าง แล้ว thaiDistribute ยืดตัวอักษรทั้งบรรทัด)
 */
/** คำที่ต้องติดกับคำถัดไปเสมอ — ตัวตัดคำแยก "ผู้|อำนวยการ", "การ|ประชุม" ทำให้ตัดบรรทัดกลางคำประสม */
const BOUND_PREFIX = new Set(["ผู้", "นัก", "การ", "ความ", "ชาว", "ช่าง", "เจ้า", "ที่", "ผู้ช่วย", "รอง"]);

export function thaiWordBreaks(text: string): string {
  let out = "";
  let prev = "";
  for (const { segment } of WORDS.segment(text)) {
    if (prev && !BOUND_PREFIX.has(prev) && THAI_CHAR.test(prev.at(-1)!) && THAI_CHAR.test(segment[0]!)) out += ZWSP;
    out += segment;
    prev = segment;
  }
  return out;
}

const UNITS = "คน|ราย|บาท|ล้านบาท|เครื่อง|ฉบับ|ชุด|เล่ม|แผ่น|วัน|เดือน|ปี|ครั้ง|ชั่วโมง|นาที|แห่ง|หน่วย|รายการ|โครงการ|หลัง|คัน|ตัว|อัน|ห้อง|ที่|ชิ้น|กล่อง|รุ่น|น\\.";
const NUM_UNIT = new RegExp(`([0-9๐-๙][0-9๐-๙,.]*) (${UNITS})(?![ก-๙])`, "g");

/** ตัวเลขกับหน่วยห้ามแยกคนละบรรทัด ("๕๐ คน", "๑๒,๐๐๐ บาท") — ใช้ช่องว่างแบบไม่ตัดบรรทัด */
export function keepNumberUnits(text: string): string {
  return text
    .replace(NUM_UNIT, "$1 $2")
    .replace(/(พ\.ศ\.|ข้อ|ฉบับที่|ครั้งที่|มาตรา|วันที่) ([0-9๐-๙])/g, "$1 $2"); // คำนำหน้าตัวเลข เช่น "พ.ศ. ๒๕๖๙"
}

/** ช่องที่ระบบไม่เดา: [ระบุ] หรือ [ระบุ: ชื่อผู้ลงนาม] */
export const PLACEHOLDER_RE = /\[ระบุ[^\]]*\]/g;
export const placeholder = (what?: string) => (what ? `[ระบุ: ${what}]` : "[ระบุ]");
export const findPlaceholders = (text: string) => text.match(PLACEHOLDER_RE) ?? [];
export const isPlaceholder = (text: string | null | undefined) => !text || /^\s*\[ระบุ/.test(text);
