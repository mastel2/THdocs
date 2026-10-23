/** สร้าง .docx ตัวอย่างทุกชนิด: npm run samples [โฟลเดอร์] */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { assembleDraft, contextFromDraft } from "@thdocs/core";
import { renderDocx } from "@thdocs/render-docx";
import { thGovPack } from "@thdocs/templates-thgov";
import { PROFILE, SAMPLES } from "./samples";

const dir = process.argv[2] ?? "out/samples";
mkdirSync(dir, { recursive: true });
for (const [name, file] of Object.entries(SAMPLES)) {
  const def = thGovPack.types.find((t) => t.id === file.type)!;
  const ctx = contextFromDraft(file, PROFILE);
  const path = join(dir, `${name}.docx`);
  writeFileSync(path, await renderDocx(def.layout(assembleDraft(def, file, ctx), ctx)));
  console.log(path);
}
