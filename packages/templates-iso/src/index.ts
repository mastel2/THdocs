import type { OrgProfile, TemplatePack } from "@thdocs/core";
import { PACK } from "./common";
import { form } from "./form";
import { policy } from "./policy";
import { procedure } from "./procedure";
import { workInstruction } from "./work-instruction";

/** บริษัทสมมติสำหรับตัวอย่าง */
export const ISO_DEMO_PROFILE: OrgProfile = {
  orgName: "บริษัท ตัวอย่าง จำกัด",
  unit: "ฝ่ายประกันคุณภาพ",
  address: ["บริษัท ตัวอย่าง จำกัด", "ถนนตัวอย่าง เขตตัวอย่าง", "กรุงเทพฯ 10000"],
  phone: "0 2123 4567",
};

/** เอกสารระบบบริหารคุณภาพ — โครงเอกสารทั่วไปพร้อมการควบคุมเอกสาร (ไม่มีข้อความของมาตรฐาน ISO) */
export const isoPack: TemplatePack = {
  id: PACK,
  name: "เอกสารระบบคุณภาพ (ISO)",
  types: [procedure, workInstruction, policy, form],
  demoProfile: ISO_DEMO_PROFILE,
};

export { form, policy, procedure, workInstruction };
