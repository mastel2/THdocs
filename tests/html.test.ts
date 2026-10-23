import { describe, expect, it } from "vitest";
import { assembleDraft, contextFromDraft } from "@thdocs/core";
import { renderHtml } from "@thdocs/render-html";
import { PROFILE, SAMPLES } from "../examples/samples";
import { typeOf } from "./helpers";

function html(name: string, opts = {}) {
  const file = SAMPLES[name]!;
  const def = typeOf(file.type);
  const ctx = contextFromDraft(file, PROFILE);
  return renderHtml(def.layout(assembleDraft(def, file, ctx), ctx), opts);
}

describe("พรีวิว HTML", () => {
  it("style ของหน้ากระดาษไม่ขาดกลาง attribute (ชื่อฟอนต์มีเครื่องหมายคำพูด)", () => {
    const h = html("memo", { fallbackFonts: '"TH Sarabun New", var(--font-sarabun), sans-serif' });
    const style = /<div class="thd-page" style="([^"]*)"/.exec(h)![1]!;
    expect(style).toContain("font-size:16pt");
    expect(style).toContain("&#34;TH SarabunPSK&#34;");
  });

  it("escape ข้อความจากผู้ใช้/AI", () => {
    const file = { ...SAMPLES.memo!, wording: { ...(SAMPLES.memo!.wording as object), subject: '<img src=x onerror="alert(1)">' } };
    const def = typeOf("memo");
    const ctx = contextFromDraft(file, PROFILE);
    const h = renderHtml(def.layout(assembleDraft(def, file, ctx), ctx));
    expect(h).not.toContain("<img src=x");
    expect(h).toContain("&#60;img src=x");
  });

  it("เลขไทย ไฮไลต์ [ระบุ] และ tab stop เป็นกล่องกว้างตามตำแหน่ง", () => {
    const h = html("external_letter");
    expect(h).toContain("๒๓ ตุลาคม ๒๕๖๙");
    expect(h).toContain('<mark class="thd-ph">[ระบุ: ชื่อวิทยากร]</mark>');
    expect(h).toContain('class="thd-tab" style="min-width:10cm"');
  });
});
