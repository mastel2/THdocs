import { describe, expect, it } from "vitest";
import { blankDraft, assembleDraft, contextFromDraft } from "../packages/core/src";
import { renderDocx } from "../packages/render-docx/src";
import { PACKS, PROFILE } from "../examples/samples";

describe("เอกสารเปล่า", () => {
  for (const pack of PACKS) {
    for (const def of pack.types) {
      it(`${def.id}: ผ่าน schema ประกอบและเรนเดอร์ได้ มีช่อง [ระบุ]`, async () => {
        const file = blankDraft(def);
        expect(def.wordingSchema.safeParse(file.wording).success).toBe(true);
        expect(JSON.stringify(file.wording)).toContain("[ระบุ");
        const ctx = contextFromDraft(file, PROFILE);
        const ir = def.layout(assembleDraft(def, file, ctx), ctx);
        const buf = await renderDocx(ir, { highlightPlaceholders: true });
        expect(buf.byteLength).toBeGreaterThan(2000);
      });
    }
  }
});
