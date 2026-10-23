import { marginFindings, type OrgProfile, type TemplatePack } from "@thdocs/core";
import { PAGE } from "./layout";
import { announcement, news, statement } from "./announcement";
import { certificate } from "./certificate";
import { PACK } from "./common";
import { externalLetter } from "./external-letter";
import { memo, memoProposal } from "./memo";
import { minutes } from "./minutes";
import { order } from "./order";
import { bylaw, regulation } from "./regulation";
import { stampLetter } from "./stamp-letter";

/** หน่วยงานสมมติสำหรับตัวอย่าง */
export const DEMO_PROFILE: OrgProfile = {
  orgName: "สำนักงานตัวอย่าง",
  unit: "กองบริหารทั่วไป",
  address: ["สำนักงานตัวอย่าง", "ถนนตัวอย่าง เขตตัวอย่าง", "กรุงเทพฯ 10000"],
  phone: "0 2123 4567",
  email: "saraban@example.go.th",
  docNoPrefix: "ตย 0001",
  signer: { name: "นายตัวอย่าง ทดสอบระบบ", position: ["ผู้อำนวยการสำนักงานตัวอย่าง"] },
};

/** หนังสือราชการ ๑๑ ชนิดตามระเบียบงานสารบรรณ (+ บันทึกเสนอเรื่อง) เรียงตามหมวดของระเบียบ */
export const thGovPack: TemplatePack = {
  id: PACK,
  name: "หนังสือราชการ (ระเบียบงานสารบรรณ)",
  types: [
    // หนังสือติดต่อราชการ
    externalLetter, memo, memoProposal, stampLetter,
    // หนังสือสั่งการ
    order, regulation, bylaw,
    // หนังสือประชาสัมพันธ์
    announcement, statement, news,
    // หนังสือที่เจ้าหน้าที่ทำขึ้นหรือรับไว้เป็นหลักฐาน
    certificate, minutes,
  ],
  demoProfile: DEMO_PROFILE,
  page: PAGE,
};

// ทุกชนิดตรวจระยะขอบที่หน่วยงานปรับ เทียบมาตรฐานของชุดแม่แบบ
for (const t of thGovPack.types) t.rules.push((_d, ctx) => marginFindings(PACK, PAGE, ctx.profile, "แนวทางการพิมพ์หนังสือราชการ"));

export { announcement, bylaw, certificate, externalLetter, memo, memoProposal, minutes, news, order, regulation, stampLetter, statement };
export { PAGE, SPEC } from "./layout";
export { pairOk, salutationFor } from "./salutation";
