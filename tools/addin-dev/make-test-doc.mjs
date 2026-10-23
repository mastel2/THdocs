// สร้างเอกสารทดสอบที่เปิดแผง THdocs อัตโนมัติเมื่อ Word เปิดไฟล์ (ต้องลงทะเบียน manifest เป็น developer add-in ก่อน)
//   node tools/addin-dev/make-test-doc.mjs <ไฟล์ต้นทาง.docx> <ไฟล์ผลลัพธ์.docx>
import JSZip from "jszip";
import { readFileSync, writeFileSync } from "node:fs";

const [src, out] = process.argv.slice(2);
const ADDIN_ID = "6f0c9a3e-2b8d-4c71-9e54-1a7d3f2b8c90";
const zip = await JSZip.loadAsync(readFileSync(src));

zip.file(
  "word/webextensions/webextension1.xml",
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<we:webextension xmlns:we="http://schemas.microsoft.com/office/webextensions/webextension/2010/11" id="{3F6C1B52-7A41-4E0B-9C55-2D1E7B9A4C10}"><we:reference id="${ADDIN_ID}" version="0.1.0.0" store="${process.env.ADDIN_STORE ?? "developer"}" storeType="${process.env.ADDIN_STORE_TYPE ?? "Registry"}"/><we:alternateReferences/><we:properties/><we:bindings/><we:snapshot xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"/></we:webextension>`,
);
zip.file(
  "word/webextensions/taskpanes.xml",
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<wetp:taskpanes xmlns:wetp="http://schemas.microsoft.com/office/webextensions/taskpanes/2010/11"><wetp:taskpane dockstate="right" visibility="1" width="380" row="0"><wetp:webextensionref xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:id="rId1"/></wetp:taskpane></wetp:taskpanes>`,
);
zip.file(
  "word/webextensions/_rels/taskpanes.xml.rels",
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.microsoft.com/office/2011/relationships/webextension" Target="webextension1.xml"/></Relationships>`,
);

const rels = await zip.file("_rels/.rels").async("string");
zip.file("_rels/.rels", rels.replace("</Relationships>", `<Relationship Id="rIdTP1" Type="http://schemas.microsoft.com/office/2011/relationships/webextensiontaskpanes" Target="word/webextensions/taskpanes.xml"/></Relationships>`));
const ct = await zip.file("[Content_Types].xml").async("string");
zip.file(
  "[Content_Types].xml",
  ct.replace(
    "</Types>",
    `<Override PartName="/word/webextensions/taskpanes.xml" ContentType="application/vnd.ms-office.webextensiontaskpanes+xml"/><Override PartName="/word/webextensions/webextension1.xml" ContentType="application/vnd.ms-office.webextension+xml"/></Types>`,
  ),
);
writeFileSync(out, await zip.generateAsync({ type: "uint8array", compression: "DEFLATE" }));
console.log("สร้าง", out);
