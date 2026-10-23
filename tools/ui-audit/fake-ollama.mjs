// เซิร์ฟเวอร์จำลองที่พูดแบบ Ollama (OpenAI-compatible) พร้อม CORS ใช้กับ ui-audit
//   node tools/ui-audit/fake-ollama.mjs <port>
// พฤติกรรมพิเศษ: ถ้าข้อความผู้ใช้มีคำว่า "ช้า" จะหน่วง 4 วินาที (ทดสอบปุ่มยกเลิก)
//                ถ้ามี "คำสั่งแก้ไข" จะตอบเรื่องใหม่ (ทดสอบการสั่งแก้)
import { createServer } from "node:http";

const port = Number(process.argv[2] ?? 11500);
const memo = (subject) => ({
  subject,
  cause: ["ด้วยกองบริหารทั่วไปได้นำระบบสารบรรณอิเล็กทรอนิกส์มาใช้ แต่บุคลากรบางส่วนยังใช้งานไม่คล่อง"],
  intent: ["จึงขออนุมัติจัดอบรมให้แก่บุคลากร จำนวน 30 คน ในวันที่ 20 พฤศจิกายน 2569 ณ ห้องประชุม 2 งบประมาณ 12,000 บาท"],
  conclusion: "จึงเรียนมาเพื่อโปรดพิจารณาอนุมัติ",
});
const facts = { recipient: "ผู้อำนวยการกองคลัง", purpose: "ขออนุมัติจัดอบรม", details: null, docNo: null, date: null, signerName: null, signerPosition: null };
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type, Authorization", "Access-Control-Allow-Private-Network": "true" };

createServer((req, res) => {
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", async () => {
    if (req.method === "OPTIONS") return void res.writeHead(204, cors).end();
    if (req.url === "/v1/models") return void res.writeHead(200, { ...cors, "Content-Type": "application/json" }).end(JSON.stringify({ data: [{ id: "qwen3.5:9b" }, { id: "gemma3:12b" }] }));
    if (req.url === "/v1/chat/completions") {
      const j = JSON.parse(body);
      const user = j.messages.map((m) => m.content).join("\n");
      if (user.includes("ช้า")) await new Promise((r) => setTimeout(r, 4000));
      const name = j.response_format?.json_schema?.name;
      const content = name === "rewrite" ? { text: "ขอเรียนว่าจะจัดอบรมให้แก่บุคลากร" } : name === "facts" ? facts : memo(user.includes("คำสั่งแก้ไข") ? "เรื่องที่แก้แล้วโดย AI" : "ขออนุมัติจัดอบรมการใช้ระบบสารบรรณอิเล็กทรอนิกส์");
      return void res.writeHead(200, { ...cors, "Content-Type": "application/json" }).end(JSON.stringify({ choices: [{ message: { content: JSON.stringify(content) } }] }));
    }
    res.writeHead(404, cors).end();
  });
}).listen(port, "127.0.0.1", () => console.log("fake ollama on", port));
