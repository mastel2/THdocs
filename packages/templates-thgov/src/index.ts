import type { OrgProfile, TemplatePack } from "@thdocs/core";
import { certificate } from "./certificate";
import { PACK } from "./common";
import { externalLetter } from "./external-letter";
import { memo, memoProposal } from "./memo";

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

export const thGovPack: TemplatePack = {
  id: PACK,
  name: "หนังสือราชการ (ระเบียบงานสารบรรณ)",
  types: [externalLetter, memo, memoProposal, certificate],
  demoProfile: DEMO_PROFILE,
};

export { certificate, externalLetter, memo, memoProposal };
export { SPEC } from "./layout";
export { pairOk, salutationFor } from "./salutation";
