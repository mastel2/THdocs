/*
 * Service worker ของ THdocs
 *
 * แคชเฉพาะ "ตัวแอป": หน้าเว็บและไฟล์สำเร็จรูปที่ build ให้ (JS/CSS/ฟอนต์/ไอคอน) เพื่อเปิดแอปได้แม้ออฟไลน์
 * ไม่แคช /api/* เด็ดขาด — มีเนื้อหาเอกสารและ API key ของผู้ใช้ ต้องไปเซิร์ฟเวอร์สดทุกครั้ง
 * ไม่แตะคำขอข้ามโดเมน (ผู้ให้บริการ AI) และคำขอที่ไม่ใช่ GET
 */
const VERSION = "thdocs-v1";
const STATIC = `${VERSION}-static`; // ไฟล์ที่มีแฮชในชื่อ — ไม่เปลี่ยน จึงใช้แคชก่อนได้
const PAGES = `${VERSION}-pages`; // หน้าเว็บ — ใช้เครือข่ายก่อน แคชเป็นสำรอง

const OFFLINE_HTML = `<!doctype html><html lang="th"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>THdocs — ออฟไลน์</title>
<body style="font-family:system-ui,sans-serif;max-width:32rem;margin:4rem auto;padding:0 1rem;line-height:1.6">
<h1>ออฟไลน์อยู่</h1><p>ยังไม่เคยเปิด THdocs ตอนมีอินเทอร์เน็ตบนเครื่องนี้ จึงไม่มีหน้าแอปให้เปิด</p>
<p>เชื่อมต่ออินเทอร์เน็ตแล้วลองใหม่ หลังจากนั้นจะเปิดแอปได้แม้ออฟไลน์</p></body></html>`;

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(PAGES).then((c) => c.add("/")).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

const isStatic = (url) => url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/") || url.pathname === "/manifest.webmanifest";

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return; // ห้ามแคช: ปล่อยให้เบราว์เซอร์ไปเครือข่ายตามปกติ

  if (isStatic(url)) {
    event.respondWith(
      caches.open(STATIC).then(async (cache) => {
        const hit = await cache.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        if (res.ok) cache.put(req, res.clone());
        return res;
      }),
    );
    return;
  }

  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok && url.pathname === "/") caches.open(PAGES).then((c) => c.put("/", res.clone()));
          return res;
        })
        .catch(async () => {
          const cached = await caches.match("/", { cacheName: PAGES }); // แอปเป็นหน้าเดียว: หน้าอื่นที่ออฟไลน์ใช้หน้าแรกแทน
          return cached ?? new Response(OFFLINE_HTML, { status: 503, headers: { "Content-Type": "text/html; charset=utf-8" } });
        }),
    );
  }
});
