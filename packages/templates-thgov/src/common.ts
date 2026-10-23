import { parseThaiDate, placeholder, thaiDate, type Context, type FactSpec, type Facts, type Finding } from "@thdocs/core";

export const PACK = "th-gov";

/** ข้อเท็จจริงที่ใช้ร่วมกันทุกชนิด — ไม่บังคับ ถ้าไม่มีระบบใส่ช่อง [ระบุ] ให้ */
export const COMMON_FACTS: FactSpec[] = [
  { key: "docNo", question: "เลขที่หนังสือ", required: false, example: "ศธ ๐๒๐๑/๑๒๓" },
  { key: "date", question: "วันที่ลงหนังสือ (ไม่ระบุ = วันนี้)", required: false, example: "๒๓ ตุลาคม ๒๕๖๙" },
  { key: "signerName", question: "ชื่อผู้ลงนาม", required: false },
  { key: "signerPosition", question: "ตำแหน่งผู้ลงนาม", required: false },
];

export interface Signer {
  name: string;
  position: string[];
}

/** ส่วนราชการหรือตำแหน่งที่ออกหนังสือ — ถ้าผู้ใช้ไม่ระบุใช้ชื่อหน่วยงานในโปรไฟล์ */
export function issuerOf(facts: Facts, ctx: Context): string {
  return facts.issuer?.trim() || ctx.profile.orgName;
}

export const ISSUER_FACT: FactSpec = { key: "issuer", question: "ผู้ออก (ส่วนราชการหรือตำแหน่ง — ไม่ระบุ = ชื่อหน่วยงาน)", required: false };

/** ปีพุทธศักราชของเอกสาร */
export const yearBE = (ctx: Context) => String((ctx.options.date ?? new Date()).getFullYear() + 543);

/** แยกรายการบรรทัดละรายการจากข้อความที่ผู้ใช้กรอก */
export const lines = (s: string | null | undefined) => (s ?? "").split("\n").map((x) => x.trim()).filter(Boolean);

/** ผู้รับมาจากข้อมูลที่ผู้ใช้ให้เท่านั้น — ไม่ให้ AI เดา (โมเดลเล็กมักแต่ง เช่น "ผู้บังคับบัญชา") */
export function recipientOf(facts: Facts): string {
  const r = (facts.recipient ?? "").trim().replace(/^(กราบเรียน|เรียน|นมัสการ)\s*/, "").trim();
  return r || placeholder("ตำแหน่งผู้รับ");
}

export function signerOf(facts: Facts, ctx: Context): Signer {
  const p = ctx.profile.signer;
  return {
    name: facts.signerName?.trim() || p?.name || placeholder("ชื่อผู้ลงนาม"),
    position: facts.signerPosition?.trim()
      ? facts.signerPosition.split("\n").map((s) => s.trim()).filter(Boolean)
      : p?.position?.length ? p.position : [placeholder("ตำแหน่งผู้ลงนาม")],
  };
}

export function docNoOf(facts: Facts, ctx: Context, suffix = placeholder("เลขทะเบียนส่ง")): string {
  return facts.docNo?.trim() || `${ctx.profile.docNoPrefix || placeholder("รหัสหน่วยงาน")}/${suffix}`;
}

export function dateOf(facts: Facts, ctx: Context, withBE = false): string {
  return facts.date?.trim() || thaiDate(ctx.options.date ?? new Date(), withBE);
}

export function checkDate(value: string, ref: string, expectBE: boolean): Finding[] {
  if (/\[ระบุ/.test(value)) return [];
  const d = parseThaiDate(value);
  if (!d) {
    return [{ level: "error", rule: "DATE_FORMAT", message: "วันที่ต้องเป็น 'ตัวเลขวันที่ ชื่อเต็มของเดือน ตัวเลขปีพุทธศักราช'", where: "date", ref }];
  }
  const out: Finding[] = [];
  if (d.yearBE < 2400) out.push({ level: "error", rule: "DATE_BE", message: "ปีต้องเป็นพุทธศักราช", where: "date", ref });
  if (expectBE && !d.hasBE) out.push({ level: "info", rule: "DATE_BE_WORD", message: "บรรทัดนี้มักระบุคำว่า 'พ.ศ.' หน้าปี", where: "date", ref });
  if (!expectBE && d.hasBE) out.push({ level: "info", rule: "DATE_BE_WORD", message: "ลงเฉพาะตัวเลขปี ไม่ต้องมีคำว่า 'พ.ศ.'", where: "date", ref });
  return out;
}

export function checkDocNo(docNo: string, ref: string): Finding[] {
  return docNo.includes("/")
    ? []
    : [{ level: "error", rule: "DOC_NO", message: "ที่ ต้องเป็น 'รหัสพยัญชนะและเลขประจำเจ้าของเรื่อง/เลขทะเบียนหนังสือส่ง'", where: "docNo", ref }];
}

export function checkBody(cause: string[], intent: string[], conclusion: string): Finding[] {
  const out: Finding[] = [];
  const ref = "หลักการเขียนหนังสือราชการ (เหตุ–ความประสงค์–สรุป)";
  if (!cause.length) out.push({ level: "error", rule: "BODY_CAUSE", message: "ไม่มีภาคเหตุ", where: "wording.cause", ref });
  if (!intent.length) out.push({ level: "error", rule: "BODY_INTENT", message: "ไม่มีภาคความประสงค์", where: "wording.intent", ref });
  if (!/^\s*(จึง|ทั้งนี้|อนึ่ง)/.test(conclusion)) {
    out.push({ level: "info", rule: "BODY_CONCLUSION", message: "ภาคสรุปมักขึ้นต้นด้วย 'จึง...' เช่น 'จึงเรียนมาเพื่อโปรดพิจารณา'", where: "wording.conclusion", ref });
  }
  return out;
}
