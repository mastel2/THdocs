/**
 * .docx → แม่แบบ Word (.dotx): เปลี่ยนชนิดเนื้อหาของ word/document.xml เป็น template
 * ดับเบิลคลิก .dotx แล้ว Word เปิดเป็นเอกสารใหม่ (ไม่ทับไฟล์แม่แบบ) ขอบ/หัวกระดาษ/ฟอนต์ตามแบบครบ
 */
import JSZip from "jszip";

const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml";
const DOTX = "application/vnd.openxmlformats-officedocument.wordprocessingml.template.main+xml";

export async function toDotx(docx: ArrayBuffer | Uint8Array): Promise<Uint8Array> {
  const zip = await JSZip.loadAsync(docx);
  const ct = zip.file("[Content_Types].xml");
  if (!ct) throw new Error("ไม่ใช่ไฟล์ .docx ([Content_Types].xml หาย)");
  const xml = await ct.async("string");
  if (!xml.includes(DOCX)) throw new Error("ไม่ใช่ไฟล์ .docx ปกติ (ไม่พบ word/document.xml ชนิดเอกสาร)");
  zip.file("[Content_Types].xml", xml.replace(DOCX, DOTX));
  return zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
}
