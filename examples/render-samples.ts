/** สร้าง .docx ตัวอย่างทุกชนิดของทุกชุดแม่แบบ: npm run samples [โฟลเดอร์] */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { assembleDraft, contextFromDraft, exampleDraft } from "@thdocs/core";
import { renderDocx } from "@thdocs/render-docx";
import { PACKS } from "./samples";

const dir = process.argv[2] ?? "out/samples";
const DATE = new Date("2026-10-23T03:00:00.000Z");
mkdirSync(dir, { recursive: true });
for (const pack of PACKS) {
  for (const def of pack.types) {
    const file = exampleDraft(def, DATE)!;
    const ctx = contextFromDraft(file, pack.demoProfile ?? {});
    const path = join(dir, `${def.id}.docx`);
    writeFileSync(path, await renderDocx(def.layout(assembleDraft(def, file, ctx), ctx)));
    console.log(path);
  }
}
