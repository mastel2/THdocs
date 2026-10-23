/**
 * คำขึ้นต้น/คำลงท้ายตามฐานะผู้รับ (ระเบียบงานสารบรรณ ภาคผนวก ๒)
 * ครอบคลุมกรณีที่ใช้บ่อย; กรณีพระบรมวงศานุวงศ์ระบบไม่เลือกให้ — แจ้งให้ผู้ใช้ตรวจเอง
 */

const HIGH_OFFICE = [
  "ประธานองคมนตรี", "นายกรัฐมนตรี", "ประธานรัฐสภา", "ประธานสภาผู้แทนราษฎร", "ประธานวุฒิสภา",
  "ประธานศาลฎีกา", "ประธานศาลรัฐธรรมนูญ", "ประธานศาลปกครองสูงสุด", "ประธานกรรมการการเลือกตั้ง",
  "ประธานผู้ตรวจการแผ่นดิน", "ประธานกรรมการป้องกันและปราบปรามการทุจริตแห่งชาติ",
  "ประธานกรรมการสิทธิมนุษยชนแห่งชาติ", "ประธานกรรมการตรวจเงินแผ่นดิน", "รัฐบุรุษ",
];
const ROYAL = /^(สมเด็จพระ|พระบาทสมเด็จ|พระเจ้า|พระองค์เจ้า|หม่อมเจ้า)/;
const MONK = /^(พระครู|พระมหา|พระอธิการ|พระปลัด|พระสมุห์|พระใบฎีกา|เจ้าอาวาส|เจ้าคณะ)/;

export interface SalutationPair {
  salutation: string;
  closing: string;
  /** false = ระบบไม่แน่ใจ ผู้ใช้ต้องตรวจเอง */
  confident: boolean;
}

const PAIRS: Record<string, string> = {
  "เรียน": "ขอแสดงความนับถือ",
  "กราบเรียน": "ขอแสดงความนับถืออย่างยิ่ง",
  "นมัสการ": "ขอนมัสการด้วยความเคารพ",
};

export function salutationFor(recipient: string): SalutationPair {
  const r = recipient.trim();
  if (ROYAL.test(r)) return { salutation: "เรียน", closing: "ขอแสดงความนับถือ", confident: false };
  if (MONK.test(r)) return { salutation: "นมัสการ", closing: PAIRS["นมัสการ"]!, confident: true };
  if (HIGH_OFFICE.some((o) => r.startsWith(o))) return { salutation: "กราบเรียน", closing: PAIRS["กราบเรียน"]!, confident: true };
  return { salutation: "เรียน", closing: PAIRS["เรียน"]!, confident: true };
}

export const pairOk = (salutation: string, closing: string) => PAIRS[salutation] === closing;
