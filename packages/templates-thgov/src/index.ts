import type { TemplatePack } from "@thdocs/core";
import { certificate } from "./certificate";
import { PACK } from "./common";
import { externalLetter } from "./external-letter";
import { memo, memoProposal } from "./memo";

export const thGovPack: TemplatePack = {
  id: PACK,
  name: "หนังสือราชการ (ระเบียบงานสารบรรณ)",
  types: [externalLetter, memo, memoProposal, certificate],
};

export { certificate, externalLetter, memo, memoProposal };
export { SPEC } from "./layout";
export { pairOk, salutationFor } from "./salutation";
