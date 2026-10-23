// พร็อกซี HTTPS สำหรับทดลอง Word add-in บนเครื่อง (Office บังคับ https)
//   node tools/addin-dev/https-proxy.mjs [พอร์ตเว็บ=3100] [พอร์ต https=3443]
// ใช้ใบรับรอง out/devcert/localhost.pfx (รหัส thdocs-dev) — สร้างและเชื่อถือในที่เก็บของผู้ใช้ปัจจุบันเท่านั้น
import { readFileSync } from "node:fs";
import http from "node:http";
import https from "node:https";

const target = Number(process.argv[2] ?? 3100);
const port = Number(process.argv[3] ?? 3443);
const pfx = readFileSync(new URL("../../out/devcert/localhost.pfx", import.meta.url));

https
  .createServer({ pfx, passphrase: "thdocs-dev" }, (req, res) => {
    const up = http.request(
      { host: "127.0.0.1", port: target, path: req.url, method: req.method, headers: { ...req.headers, "x-forwarded-proto": "https", "x-forwarded-host": `localhost:${port}` } },
      (r) => {
        res.writeHead(r.statusCode ?? 502, r.headers);
        r.pipe(res);
      },
    );
    up.on("error", () => res.writeHead(502).end("เว็บ THdocs ยังไม่ทำงานที่พอร์ต " + target));
    req.pipe(up);
  })
  .listen(port, "127.0.0.1", () => console.log(`https://localhost:${port} → http://127.0.0.1:${target}`));
