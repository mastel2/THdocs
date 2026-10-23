import JSZip from "jszip";
import { assembleDraft, contextFromDraft, type DraftFile } from "@thdocs/core";
import { renderDocx } from "@thdocs/render-docx";
import { thGovPack } from "@thdocs/templates-thgov";
import { PROFILE } from "../examples/samples";

export const typeOf = (id: string) => thGovPack.types.find((t) => t.id === id)!;

export async function renderSample(file: DraftFile) {
  const def = typeOf(file.type);
  const ctx = contextFromDraft(file, PROFILE);
  const doc = assembleDraft(def, file, ctx);
  const buf = await renderDocx(def.layout(doc, ctx));
  const zip = await JSZip.loadAsync(buf);
  const rawXml = await zip.file("word/document.xml")!.async("string");
  const xml = rawXml.replace(/​/g, ""); // ตัดจุดตัดคำที่มองไม่เห็นออก เพื่อค้นข้อความได้ตรง
  const parts = Object.keys(zip.files);
  const text = [...xml.matchAll(/<w:t(?: [^>]*)?>([^<]*)<\/w:t>/g)].map((m) => m[1]).join("").replace(/​/g, "");
  return { def, ctx, doc, buf, zip, rawXml, xml, text, parts };
}
