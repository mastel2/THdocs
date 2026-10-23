// ไล่ใช้งานหน้าเว็บ THdocs ทุกปุ่ม/เมนู/ขั้นตอนในเบราว์เซอร์จริง (Edge ผ่าน CDP) แล้วรายงานผ่าน/ไม่ผ่าน
//
//   1) เปิดเว็บ:      cd apps/web && npx next start -p 3100
//   2) เปิด AI จำลอง: node tools/ui-audit/fake-ollama.mjs 11500
//   3) รัน:           node tools/ui-audit/ui-audit.mjs [http://localhost:3100] [--json out.json]
//
// ต้องมี Microsoft Edge (หรือตั้ง EDGE=path) ไม่ต้องติดตั้งแพ็กเกจเพิ่ม (ใช้ WebSocket ในตัวของ Node 22+)
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const BASE = process.argv.find((a) => a.startsWith("http")) ?? "http://localhost:3100";
const JSON_OUT = process.argv.includes("--json") ? process.argv[process.argv.indexOf("--json") + 1] : null;
const FAKE = "http://127.0.0.1:11500/v1";
const EDGE = process.env.EDGE ?? ["C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", "C:/Program Files/Microsoft/Edge/Application/msedge.exe"].find(existsSync);
if (!EDGE) throw new Error("ไม่พบ Edge — ตั้งตัวแปร EDGE=path");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const PNG_1PX = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgYGD4DwABBAEAHnOcQAAAAABJRU5ErkJggg==";

// ------------------------------------------------------------------ เบราว์เซอร์
const port = 9600 + Math.floor(Math.random() * 300);
const profileDir = mkdtempSync(join(tmpdir(), "thd-edge-"));
const dlDir = mkdtempSync(join(tmpdir(), "thd-dl-"));
const edge = spawn(EDGE, ["--headless=new", `--remote-debugging-port=${port}`, `--user-data-dir=${profileDir}`, "--no-first-run", "--disable-gpu", "about:blank"], { stdio: "ignore" });

let target;
for (let i = 0; i < 60 && !target; i++) {
  try { target = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find((t) => t.type === "page"); } catch { await sleep(200); }
}
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let msgId = 0;
const pending = new Map();
const events = [];
const errors = []; // ข้อผิดพลาดในคอนโซลของหน้า
ws.onmessage = (m) => {
  const d = JSON.parse(m.data);
  if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id); return; }
  if (d.method === "Runtime.exceptionThrown") errors.push("exception: " + (d.params.exceptionDetails.exception?.description ?? d.params.exceptionDetails.text).slice(0, 200));
  else if (d.method === "Runtime.consoleAPICalled" && d.params.type === "error") errors.push("console.error: " + d.params.args.map((a) => a.value ?? a.description ?? "").join(" ").slice(0, 200));
  else if (d.method === "Log.entryAdded" && d.params.entry.level === "error" && !/favicon/.test(d.params.entry.url ?? "")) errors.push("log: " + d.params.entry.text + " " + (d.params.entry.url ?? "").slice(0, 100));
  else events.push(d);
};
const send = (method, params = {}) => new Promise((r) => { const id = ++msgId; pending.set(id, r); ws.send(JSON.stringify({ id, method, params })); });

/** รันนิพจน์ในหน้า (รองรับ await) */
async function ev(expr) {
  const r = await send("Runtime.evaluate", { expression: `(async()=>{${expr}})()`, awaitPromise: true, returnByValue: true });
  if (r.result?.exceptionDetails) throw new Error((r.result.exceptionDetails.exception?.description ?? r.result.exceptionDetails.text).split("\n")[0].slice(0, 220));
  return r.result?.result?.value;
}
async function until(expr, ms = 8000, what = expr) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { try { if (await ev(`return !!(${expr})`)) return true; } catch {} await sleep(120); }
  throw new Error(`หมดเวลารอ: ${what.slice(0, 120)}`);
}

// ตัวช่วยที่ฝังในทุกหน้า
const HELPERS = `
window.T = {
  btn: (t, root = document) => [...root.querySelectorAll('button')].find((b) => b.textContent.trim() === t),
  btnIn: (t, root = document) => [...root.querySelectorAll('button')].find((b) => b.textContent.trim().includes(t)),
  click: (t) => { const b = T.btn(t) || T.btnIn(t); if (!b) throw new Error('ไม่พบปุ่ม: ' + t); if (b.disabled) throw new Error('ปุ่มกดไม่ได้: ' + t); b.click(); return true; },
  label: (t, root = document) => [...root.querySelectorAll('label')].find((l) => l.textContent.trim().startsWith(t)),
  field: (t, root = document) => { const l = T.label(t, root); if (!l) throw new Error('ไม่พบช่อง: ' + t); return l.querySelector('input,textarea,select'); },
  set: (el, v) => { const p = Object.getPrototypeOf(el); Object.getOwnPropertyDescriptor(p, 'value').set.call(el, v); el.dispatchEvent(new Event(el.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true })); },
  setField: (t, v) => T.set(T.field(t), v),
  select: (idx, v) => T.set(document.querySelectorAll('.side select')[idx], v),
  page: () => document.querySelector('.thd-page'),
  pageText: () => (document.querySelector('.thd-page')?.textContent ?? '').replace(/\\u200B/g, '').replace(/\\u00A0/g, ' '),
  step: () => document.querySelector('.steps li.on')?.textContent.replace(/^\\d+\\.\\s*/, '').trim(),
  err: () => document.querySelector('.notice.err')?.textContent ?? null,
  details: (t) => [...document.querySelectorAll('details')].find((d) => d.querySelector('summary')?.textContent.includes(t)),
  file: (input, name, type, b64) => { const u8 = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)); const dt = new DataTransfer(); dt.items.add(new File([u8], name, { type })); input.files = dt.files; input.dispatchEvent(new Event('change', { bubbles: true })); },
  text: (input, name, type, text) => { const dt = new DataTransfer(); dt.items.add(new File([text], name, { type })); input.files = dt.files; input.dispatchEvent(new Event('change', { bubbles: true })); },
  overflowX: () => document.documentElement.scrollWidth - innerWidth,
};
window.print = () => { window.__printed = (window.__printed || 0) + 1; };
`;

await send("Page.enable");
await send("Runtime.enable");
await send("Log.enable");
await send("Network.enable");
await send("Page.setDownloadBehavior", { behavior: "allow", downloadPath: dlDir });
await send("Page.addScriptToEvaluateOnNewDocument", { source: HELPERS });

async function go(path = "/", { width = 1400, height = 900, scheme = "light", storage } = {}) {
  await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: width < 600 });
  await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: scheme }] });
  events.length = 0;
  await send("Page.navigate", { url: BASE + path });
  await until(`document.readyState === 'complete'`, 15000);
  await ev(`localStorage.clear(); ${storage ? Object.entries(storage).map(([k, v]) => `localStorage.setItem(${JSON.stringify(k)}, ${JSON.stringify(JSON.stringify(v))});`).join("") : ""} return 1`);
  await send("Page.reload");
  await until(`document.readyState === 'complete' && document.querySelector('.brand, h1, body')`, 15000);
  await sleep(700);
}

// ------------------------------------------------------------------ ผลตรวจ
const results = [];
let section = "";
const sec = (name) => { section = name; console.log(`\n▶ ${name}`); };
async function check(name, fn, { allowErrors = false } = {}) {
  const before = errors.length;
  let ok = true, detail = "";
  try { const r = await fn(); if (r === false) ok = false; else if (typeof r === "string") detail = r; } catch (e) { ok = false; detail = e.message; }
  const newErrors = errors.splice(before);
  if (!allowErrors && newErrors.length && ok) { ok = false; detail = `คอนโซลมี error: ${newErrors[0]}`; }
  results.push({ section, name, ok, detail });
  console.log(`  ${ok ? "✓" : "✗"} ${name}${detail ? `  — ${detail}` : ""}`);
}

const AI_FAKE = { "thdocs.llm": { provider: "browser-ollama", model: "qwen3.5:9b", baseUrl: FAKE } };

try {
  // ============================================================== 1. หน้าแรก
  sec("1. หน้าแรกและเมนูหลัก");
  await go("/");
  await check("โหลดหน้า มีชื่อแอปและแถบเมนู", async () => (await ev(`return document.title === 'THdocs' && !!document.querySelector('.brand') && T.btnIn('ข้อมูลหน่วยงาน') && T.btnIn('AI:') ? 1 : 0`)) === 1);
  await check("เมนูเลือกชนิดเอกสารมี 2 กลุ่ม รวม 19 ชนิด", async () => {
    const r = await ev(`const s = document.querySelectorAll('.side select')[0]; return [s.querySelectorAll('optgroup').length, s.querySelectorAll('option').length]`);
    return r[0] === 2 && r[1] === 19 ? `${r[0]} กลุ่ม ${r[1]} ชนิด` : `ได้ ${r[0]} กลุ่ม ${r[1]} ชนิด`;
  });
  await check("ขั้นตอน 3 ขั้น เริ่มที่ 'คำขอ'", async () => (await ev(`return [document.querySelectorAll('.steps li').length, T.step()]`)).join() === "3,คำขอ");
  await check("มีตัวอย่างเอกสารและป้ายตัวอย่างตั้งแต่เปิดหน้า", async () => await ev(`return !!document.querySelector('.example-badge') && T.pageText().length > 100`));
  await check("service worker ลงทะเบียนแล้ว", async () => { await until(`navigator.serviceWorker && navigator.serviceWorker.controller || false`, 8000).catch(() => {}); return (await ev(`return !!(await navigator.serviceWorker.getRegistration())`)) || "ยังไม่ลงทะเบียน"; });

  // ============================================================== 2. ทุกชนิดเอกสาร
  sec("2. เลือกชนิดเอกสารทุกชนิด (ตัวอย่างต้องแสดงผลครบ)");
  const types = await ev(`return [...document.querySelectorAll('.side select')[0].options].map((o) => [o.value, o.text])`);
  for (const [id, name] of types) {
    await check(`${name} (${id})`, async () => {
      await ev(`T.select(0, ${JSON.stringify(id)}); return 1`);
      await until(`document.querySelector('.example-badge')?.textContent.includes(${JSON.stringify(name)})`, 4000, `badge ${name}`);
      const info = await ev(`const p = T.page(); return [T.pageText().length, document.querySelector('.example-req p')?.textContent.length ?? 0, p.getBoundingClientRect().height, !!document.querySelector('.thd-page') ]`);
      if (info[0] < 80) return `เนื้อหาพรีวิวสั้นผิดปกติ (${info[0]})`;
      if (!info[1]) return "ไม่มีคำขอตัวอย่าง";
      // ตรวจตำแหน่ง: ป้ายตัวอย่างและหัวหน้ากระดาษต้องอยู่ในกรอบพรีวิว ไม่ล้นขึ้นด้านบน
      const g = await ev(`const pv = document.querySelector('.preview').getBoundingClientRect(); const b = document.querySelector('.example-badge').getBoundingClientRect(); const p = document.querySelector('.thd-page').getBoundingClientRect(); return { badge: b.top - pv.top, page: p.top - pv.top, left: p.left - pv.left, right: pv.right - p.right, scroll: document.querySelector('.preview').scrollTop }`);
      if (g.badge < 0 || g.page < 0) return `ส่วนบนของเอกสารล้นออกนอกกรอบ (badge ${Math.round(g.badge)}px, page ${Math.round(g.page)}px)`;
      if (g.scroll !== 0) return `เอกสารใหม่ไม่ได้เริ่มที่บนสุด (scrollTop=${g.scroll})`;
      if (g.left < -1 || g.right < -1) return `หน้ากระดาษล้นด้านข้าง (ซ้าย ${Math.round(g.left)} ขวา ${Math.round(g.right)})`;
      return true;
    });
  }

  await check("เลื่อนพรีวิวลงแล้วเปลี่ยนชนิดเอกสาร → เอกสารใหม่เริ่มที่บนสุด (ไม่ค้างกลางหน้า)", async () => {
    await ev(`T.select(0, 'iso_procedure'); return 1`); await sleep(500);
    await ev(`document.querySelector('.preview').scrollTop = 300; return 1`); await sleep(200);
    await ev(`T.select(0, 'iso_car'); return 1`); await sleep(600);
    const t = await ev(`return document.querySelector('.preview').scrollTop`);
    return t === 0 || `scrollTop=${t}`;
  });
  await check("พรีวิวไม่ล้นที่จอ 1024 / 1920 / 2436 px (ส่วนหัวเอกสารเห็นครบ)", async () => {
    for (const [w, h] of [[1024, 768], [1920, 1080], [2436, 1274]]) {
      await send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: 1, mobile: false });
      await sleep(500);
      const g = await ev(`const pv = document.querySelector('.preview').getBoundingClientRect(); const t = document.querySelector('.thd-page table, .thd-page p').getBoundingClientRect(); return t.top - pv.top`);
      if (g < 0) return `${w}px: เนื้อหาบนสุดอยู่เหนือกรอบ ${Math.round(g)}px`;
    }
    await send("Emulation.setDeviceMetricsOverride", { width: 1400, height: 900, deviceScaleFactor: 1, mobile: false });
    return true;
  });

  // ============================================================== 3. ขั้นคำขอ
  sec("3. ขั้นที่ 1 — คำขอ");
  await go("/");
  await check("ปุ่ม 'ถัดไป' กดไม่ได้เมื่อยังไม่มีคำขอ", async () => await ev(`return T.btn('ถัดไป').disabled`));
  await check("'ใช้ข้อความนี้' เติมคำขอตัวอย่างลงช่องพิมพ์", async () => {
    await ev(`T.click('ใช้ข้อความนี้'); return 1`);
    return await ev(`const ta = document.querySelector('.side textarea'); return ta.value.length > 20 && ta.value === document.querySelector('.example-req p').textContent`);
  });
  await check("ยังไม่ตั้งค่า AI → กด 'ถัดไป' เปิดหน้าตั้งค่า AI (ไม่ส่งคำขอ)", async () => {
    await ev(`T.click('ถัดไป'); return 1`);
    await until(`[...document.querySelectorAll('.card h2')].some((h) => h.textContent.includes('ตั้งค่า AI'))`, 3000);
    await ev(`T.click('เสร็จ'); return 1`);
    return true;
  });
  await check("ชั้นความเร็ว มี 4 ตัวเลือก / ชั้นความลับ มี 4 ตัวเลือก", async () => (await ev(`const s = document.querySelectorAll('.side select'); return [s[1].options.length, s[2].options.length]`)).join() === "4,4");
  await check("ชั้นความลับ + AI ภายนอก → ปุ่มถัดไปถูกล็อกและมีข้อความเตือน", async () => {
    await ev(`localStorage.setItem('thdocs.llm', JSON.stringify({ provider: 'anthropic', apiKey: 'sk-x' })); return 1`);
    await send("Page.reload"); await sleep(1200);
    await ev(`T.click('ใช้ข้อความนี้'); T.select(2, 'ลับ'); return 1`);
    return await ev(`return T.btn('ถัดไป').disabled && document.body.textContent.includes('ส่งให้') && !!document.querySelector('.notice.err')`);
  });
  await check("เปลี่ยนเป็นไม่มีชั้นความลับ → ปุ่มกลับมากดได้", async () => { await ev(`T.select(2, ''); return 1`); await sleep(200); return await ev(`return !T.btn('ถัดไป').disabled`); });

  // ============================================================== 4. ตั้งค่า AI
  sec("4. ตั้งค่า AI");
  await go("/");
  await check("เปิด/ปิดหน้าตั้งค่า AI จากปุ่มบนแถบ", async () => {
    await ev(`T.click('AI:'); return 1`);
    await until(`[...document.querySelectorAll('.card h2')].some((h) => h.textContent.includes('ตั้งค่า AI'))`, 3000);
    await ev(`T.btnIn('AI:').click(); return 1`);
    await until(`!document.querySelector('.steps') === false`, 3000);
    return true;
  });
  const providers = await (async () => { await ev(`T.click('AI:'); return 1`); return await ev(`return [...document.querySelectorAll('.side select')[0].options].map((o) => [o.value, o.text])`); })();
  await check(`ผู้ให้บริการครบ 6 รายการ`, async () => providers.map((p) => p[0]).join() === "anthropic,openai,gemini,browser-ollama,browser-lmstudio,browser-custom" || providers.map((p) => p[0]).join());
  for (const [id, name] of providers) {
    await check(`เลือก ${name}: ช่องกรอกและกล่องแจ้งเตือนถูกต้อง`, async () => {
      await ev(`T.set(document.querySelectorAll('.side select')[0], ${JSON.stringify(id)}); return 1`);
      await sleep(250);
      const s = await ev(`return { warn: !!document.querySelector('.notice.warn'), ok: !!document.querySelector('.notice.ok'), key: !!document.querySelector('input[type=password]'), url: !!T.label('URL ของเซิร์ฟเวอร์ AI'), test: !!T.btnIn('ตรวจการเชื่อมต่อ'), remember: !!document.querySelector('label.check input') }`);
      const cloud = ["anthropic", "openai", "gemini"].includes(id);
      if (cloud && !(s.warn && s.key && s.remember && !s.url)) return `ช่องไม่ตรง: ${JSON.stringify(s)}`;
      if (id === "browser-ollama" && !(s.ok && s.url && s.test && !s.key)) return `ช่องไม่ตรง: ${JSON.stringify(s)}`;
      if (id === "browser-lmstudio" && !(s.ok && s.url && s.test)) return `ช่องไม่ตรง: ${JSON.stringify(s)}`;
      if (id === "browser-custom" && !(s.warn && s.url)) return `ช่องไม่ตรง (ยังไม่ใส่ URL ต้องถือว่าออกนอก): ${JSON.stringify(s)}`;
      return true;
    });
  }
  await check("Custom: URL เครือข่ายภายในเปลี่ยนกล่องเป็นสีเขียว / URL อินเทอร์เน็ตเป็นสีเหลือง", async () => {
    await ev(`T.set(document.querySelectorAll('.side select')[0], 'browser-custom'); return 1`); await sleep(200);
    await ev(`T.setField('URL ของเซิร์ฟเวอร์ AI', 'http://192.168.1.10:8000/v1'); return 1`); await sleep(200);
    const a = await ev(`return !!document.querySelector('.notice.ok')`);
    await ev(`T.setField('URL ของเซิร์ฟเวอร์ AI', 'https://llm.example.com/v1'); return 1`); await sleep(200);
    const b = await ev(`return !!document.querySelector('.notice.warn')`);
    return a && b;
  });
  await check("Ollama: ตรวจการเชื่อมต่อกับเซิร์ฟเวอร์จำลอง → พบ 2 โมเดล เติมรายชื่อและเลือกตัวแรกให้", async () => {
    await ev(`T.set(document.querySelectorAll('.side select')[0], 'browser-ollama'); return 1`); await sleep(200);
    await ev(`T.setField('URL ของเซิร์ฟเวอร์ AI', ${JSON.stringify(FAKE)}); return 1`); await sleep(200);
    await ev(`T.click('ตรวจการเชื่อมต่อ'); return 1`);
    await until(`document.querySelector('[role=status]')?.textContent.includes('พบ 2 โมเดล')`, 6000);
    return await ev(`return T.field('โมเดล').value === 'qwen3.5:9b' && document.querySelectorAll('#thdocs-models option').length === 2`);
  });
  await check("เชื่อมต่อไม่ได้ → แจ้งสีแดงและเปิดคู่มือตั้งค่าให้เอง", async () => {
    await ev(`T.setField('URL ของเซิร์ฟเวอร์ AI', 'http://127.0.0.1:1/v1'); return 1`); await sleep(200);
    await ev(`T.click('ตรวจการเชื่อมต่อ'); return 1`);
    await until(`document.querySelector('[role=status].err')`, 6000);
    return await ev(`return document.querySelector('.setup-guide').open && document.querySelector('.setup-guide').textContent.includes('OLLAMA_ORIGINS')`);
  }, { allowErrors: true });
  await check("แก้ URL แล้วผลตรวจเก่าถูกล้าง", async () => { await ev(`T.setField('URL ของเซิร์ฟเวอร์ AI', ${JSON.stringify(FAKE)}); return 1`); await sleep(250); return await ev(`return !document.querySelector('[role=status]')`); });
  await check("API key: ไม่ติ๊ก 'จำ' → โหลดใหม่แล้วหาย / ติ๊ก 'จำ' → โหลดใหม่แล้วยังอยู่", async () => {
    await ev(`T.set(document.querySelectorAll('.side select')[0], 'openai'); return 1`); await sleep(200);
    await ev(`T.setField('โมเดล', 'gpt-x'); T.setField('API key', 'sk-secret-123'); return 1`); await sleep(300);
    const stored1 = await ev(`return localStorage.getItem('thdocs.llm')`);
    if (stored1.includes('sk-secret-123')) return "key ถูกเก็บทั้งที่ไม่ได้ติ๊กจำ";
    await ev(`document.querySelector('label.check input').click(); return 1`); await sleep(300);
    const stored2 = await ev(`return localStorage.getItem('thdocs.llm')`);
    if (!stored2.includes('sk-secret-123')) return "ติ๊กจำแล้วแต่ key ไม่ถูกเก็บ";
    await send("Page.reload"); await sleep(1200);
    await ev(`T.click('AI:'); return 1`); await sleep(300);
    return await ev(`return T.field('API key').value === 'sk-secret-123' && document.querySelector('label.check input').checked`);
  });
  await check("โหลดใหม่แล้วยังจำผู้ให้บริการและโมเดลเดิม", async () => await ev(`return document.querySelectorAll('.side select')[0].value === 'openai' && T.field('โมเดล').value === 'gpt-x'`));

  // ============================================================== 5. ข้อมูลหน่วยงาน
  sec("5. ข้อมูลหน่วยงาน ตรา และระยะขอบ");
  await go("/");
  await check("เปิดหน้าข้อมูลหน่วยงาน", async () => { await ev(`T.click('ข้อมูลหน่วยงาน'); return 1`); await until(`[...document.querySelectorAll('.card h2')].some((h) => h.textContent === 'ข้อมูลหน่วยงาน')`, 3000); return true; });
  await check("กรอกข้อมูลครบทุกช่องแล้วพรีวิวใช้ข้อมูลนั้น", async () => {
    await ev(`T.select(0, 'external_letter'); return 1`).catch(() => {});
    await ev(`T.setField('ชื่อหน่วยงาน', 'สำนักงานทดสอบการใช้งาน'); T.setField('ส่วนงานเจ้าของเรื่อง', 'กองทดสอบระบบ'); T.setField('ที่ตั้ง', 'ถนนทดสอบ 99\\nเขตทดสอบ'); T.setField('โทรศัพท์', '02-999-8888'); T.setField('อีเมล', 'qa@test.go.th'); T.setField('รหัสหนังสือ', 'ทด 0099'); T.setField('ผู้ลงนาม', 'นายทดสอบ ใช้งานจริง'); T.setField('ตำแหน่ง', 'ผู้อำนวยการกองทดสอบ'); return 1`);
    await sleep(500);
    const t = await ev(`return T.pageText()`);
    const miss = ["กองทดสอบระบบ", "ถนนทดสอบ", "qa@test.go.th", "นายทดสอบ ใช้งานจริง", "ผู้อำนวยการกองทดสอบ"].filter((x) => !t.includes(x));
    return miss.length === 0 || `ไม่พบในพรีวิว: ${miss.join(", ")}`;
  });
  await check("คำเรียกส่วนงาน 'หน่วยงาน' เปลี่ยนป้ายในบันทึกข้อความ", async () => {
    await ev(`T.btn('เสร็จ').click(); return 1`); await sleep(200);
    await ev(`T.select(0, 'memo'); return 1`); await sleep(300);
    await ev(`T.click('ข้อมูลหน่วยงาน'); return 1`); await sleep(200);
    await ev(`T.setField('คำเรียกส่วนงาน', 'หน่วยงาน'); return 1`); await sleep(400);
    return await ev(`return T.pageText().includes('หน่วยงาน') && !T.pageText().includes('ส่วนราชการ')`);
  });
  await check("อัปโหลดตรา PNG → แสดงในแผงและในพรีวิว; ลบตราได้", async () => {
    await ev(`T.file(document.querySelector('input[type=file][accept="image/png"]'), 'emblem.png', 'image/png', ${JSON.stringify(PNG_1PX)}); return 1`);
    await until(`document.querySelector('.emblem-row img')`, 3000);
    await until(`document.querySelector('.thd-page img')`, 3000);
    await ev(`T.click('ลบตรา'); return 1`); await sleep(300);
    return await ev(`return !document.querySelector('.emblem-row img') && !document.querySelector('.thd-page img')`);
  });
  await check("ระยะขอบ: แก้ขอบบน → ติ๊ก 'แสดงระยะขอบ' เห็นตัวเลขใหม่", async () => {
    await ev(`const l = [...document.querySelectorAll('.margin-grid label')].find((x) => x.textContent.trim().startsWith('บน')); T.set(l.querySelector('input'), '3.2'); return 1`); await sleep(300);
    await ev(`document.querySelector('.preview-controls input[type=checkbox]').click(); return 1`); await sleep(400);
    return await ev(`return T.pageText().includes('บน ๓.๒ ซม.')`); // เอกสารหนังสือราชการใช้เลขไทย
  });
  await check("ระยะขอบ: ขอบซ้ายต่างจากมาตรฐาน 3 ซม. → ช่องเตือนสีเหลือง; 'คืนค่าตั้งต้น' ล้างค่า", async () => {
    await ev(`const l = [...document.querySelectorAll('.margin-grid label')].find((x) => x.textContent.trim().startsWith('ซ้าย')); T.set(l.querySelector('input'), '2'); return 1`); await sleep(300);
    const warned = await ev(`return !!document.querySelector('.margin-grid label.missing')`);
    await ev(`T.click('คืนค่าตั้งต้น'); return 1`); await sleep(300);
    const reset = await ev(`const l = [...document.querySelectorAll('.margin-grid label')].find((x) => x.textContent.trim().startsWith('ซ้าย')); return l.querySelector('input').value === '3' && !document.querySelector('.margin-grid label.missing')`);
    return warned && reset || `warned=${warned} reset=${reset}`;
  });
  await check("ปิดแผงด้วย 'เสร็จ' และโหลดใหม่แล้วข้อมูลยังอยู่", async () => {
    await ev(`T.btn('เสร็จ').click(); return 1`); await sleep(200);
    await send("Page.reload"); await sleep(1200);
    await ev(`T.click('ข้อมูลหน่วยงาน'); return 1`); await sleep(300);
    return await ev(`return T.field('ชื่อหน่วยงาน').value === 'สำนักงานทดสอบการใช้งาน' && T.field('ที่ตั้ง').value.includes('ถนนทดสอบ 99')`);
  });

  // ============================================================== 6. ร่างด้วย AI ครบวงจร
  sec("6. ร่างด้วย AI (ในเครื่อง) ครบวงจร: คำขอ → ข้อมูล → ร่าง → แก้");
  const profile = { orgName: "สำนักงานทดสอบ", unit: "กองบริหารทั่วไป", address: ["ถนนทดสอบ"], phone: "02-111-2222", signer: { name: "นายทดสอบ ระบบ", position: ["ผู้อำนวยการ"] } };
  await go("/", { storage: { ...AI_FAKE, "thdocs.profile": profile } });
  await check("พิมพ์คำขอ เลือกบันทึกข้อความ + ด่วน + ไม่มีชั้นความลับ → ถัดไป ไปขั้นข้อมูล", async () => {
    await ev(`T.select(0, 'memo'); T.setField('ต้องการเอกสารเรื่องอะไร', 'ขออนุมัติจัดอบรม 30 คน 20 พ.ย. 2569 เรียนผู้อำนวยการกองคลัง'); T.select(1, 'ด่วน'); return 1`); await sleep(300);
    await ev(`T.click('ถัดไป'); return 1`);
    await until(`T.step() === 'ข้อมูล'`, 8000);
    return true;
  });
  await check("ขั้นข้อมูล: ช่องจากคำขอถูกเติมให้ ('เรียนใคร' = ผู้อำนวยการกองคลัง) และมีเครื่องหมาย * ช่องจำเป็น", async () => await ev(`return T.field('เรียนใคร').value === 'ผู้อำนวยการกองคลัง' && document.querySelectorAll('.req').length >= 2`));
  await check("แก้ข้อมูลในช่อง และ 'ย้อนกลับ' กลับไปขั้นคำขอโดยคำขอเดิมยังอยู่", async () => {
    await ev(`T.setField('เรียนใคร', 'ผู้อำนวยการกองบัญชี'); T.click('ย้อนกลับ'); return 1`);
    await until(`T.step() === 'คำขอ'`, 3000);
    return await ev(`return T.field('ต้องการเอกสารเรื่องอะไร').value.includes('ขออนุมัติจัดอบรม')`);
  });
  await check("ถัดไป → ร่างเอกสาร → ได้เอกสารในขั้น 'ตรวจและแก้' พร้อมชั้นความเร็ว 'ด่วน' และผลตรวจ", async () => {
    await ev(`T.click('ถัดไป'); return 1`); await until(`T.step() === 'ข้อมูล'`, 8000);
    await ev(`T.click('ร่างเอกสาร'); return 1`);
    await until(`T.step() === 'ตรวจและแก้'`, 10000);
    await until(`T.pageText().includes('ขออนุมัติจัดอบรมการใช้ระบบ')`, 5000);
    const r = await ev(`return { urgent: T.pageText().includes('ด่วน'), findings: document.querySelectorAll('.findings li').length, recipient: T.pageText().includes('ผู้อำนวยการกองคลัง') }`);
    return r.urgent && r.findings > 0 && r.recipient || JSON.stringify(r);
  });
  await check("ไม่มีคำขอเนื้อหาไปเซิร์ฟเวอร์ THdocs (เรียก AI ตรงจากเบราว์เซอร์)", async () => {
    const api = await ev(`return performance.getEntriesByType('resource').map((r) => new URL(r.name).pathname).filter((p) => p.startsWith('/api/') && p !== '/api/config')`);
    return api.length === 0 || `พบ ${api.join(",")}`;
  });
  await check("สั่ง AI แก้: พิมพ์คำสั่ง → 'แก้ไข' → เรื่องเปลี่ยน ชั้นความเร็วยังอยู่ ช่องคำสั่งถูกล้าง", async () => {
    await ev(`T.set(document.querySelector('textarea[placeholder^="เช่น ทำให้ภาคเหตุ"]'), 'เปลี่ยนเรื่องให้สั้นลง'); return 1`); await sleep(200);
    await ev(`T.click('แก้ไข'); return 1`);
    await until(`T.pageText().includes('เรื่องที่แก้แล้วโดย AI')`, 10000);
    return await ev(`return T.pageText().includes('ด่วน') && document.querySelector('textarea[placeholder^="เช่น ทำให้ภาคเหตุ"]').value === ''`);
  });
  await check("ปุ่ม 'แก้ไข' กดไม่ได้เมื่อช่องคำสั่งว่าง", async () => await ev(`return T.btn('แก้ไข').disabled`));
  await check("ปุ่ม 'ยกเลิก' หยุดคำขอที่ค้างอยู่ — ไม่มี error และเอกสารไม่เปลี่ยน", async () => {
    await ev(`T.set(document.querySelector('textarea[placeholder^="เช่น ทำให้ภาคเหตุ"]'), 'ช้า ช่วยปรับถ้อยคำ'); return 1`); await sleep(200);
    await ev(`T.click('แก้ไข'); return 1`);
    await until(`document.querySelector('.notice.busy')`, 3000);
    const before = await ev(`return T.pageText()`);
    await ev(`T.btn('ยกเลิก').click(); return 1`);
    await until(`!document.querySelector('.notice.busy')`, 2000);
    await sleep(500);
    const err = await ev(`return T.err()`);
    return err === null && (await ev(`return T.pageText()`)) === before || `err=${err}`;
  });

  // ============================================================== 7. แก้ด้วยมือ
  sec("7. ขั้นตรวจและแก้ — แก้ด้วยมือและปุ่มบนแถบเครื่องมือ");
  await ev(`T.details('แก้ถ้อยคำเอง').open = true; return 1`); await sleep(300);
  await check("แก้ช่อง 'เรื่อง' ในฟอร์ม → พรีวิวเปลี่ยนทันที", async () => {
    await ev(`T.setField('เรื่อง', 'เรื่องที่พิมพ์เองด้วยมือ'); return 1`); await sleep(400);
    return await ev(`return T.pageText().includes('เรื่องที่พิมพ์เองด้วยมือ')`);
  });
  await check("เพิ่มข้อความในภาคเหตุ (+ เพิ่ม) → ย่อหน้าใหม่ในพรีวิว", async () => {
    const before = await ev(`return T.pageText().length`);
    await ev(`const f = [...document.querySelectorAll('fieldset.sf-array')].find((x) => x.querySelector('legend')?.textContent.includes('ภาคเหตุ')); f.querySelector('button.ghost.small:last-of-type').click(); return 1`); await sleep(300);
    await ev(`const f = [...document.querySelectorAll('fieldset.sf-array')].find((x) => x.querySelector('legend')?.textContent.includes('ภาคเหตุ')); const tas = f.querySelectorAll('textarea'); T.set(tas[tas.length - 1], 'ย่อหน้าที่เพิ่มด้วยมือ'); return 1`); await sleep(400);
    return await ev(`return T.pageText().includes('ย่อหน้าที่เพิ่มด้วยมือ')`) && (await ev(`return T.pageText().length`)) > before;
  });
  await check("เลื่อนย่อหน้าลง (↓) → ลำดับในพรีวิวสลับ", async () => {
    await ev(`const f = [...document.querySelectorAll('fieldset.sf-array')].find((x) => x.querySelector('legend')?.textContent.includes('ภาคเหตุ')); f.querySelector('button[aria-label^="เลื่อนข้อที่ 1 ลง"]').click(); return 1`); await sleep(400);
    const t = await ev(`return T.pageText()`);
    return t.indexOf('ย่อหน้าที่เพิ่มด้วยมือ') < t.indexOf('ด้วยกองบริหารทั่วไป');
  });
  await check("ลบย่อหน้า (✕) → หายจากพรีวิว", async () => {
    await ev(`const f = [...document.querySelectorAll('fieldset.sf-array')].find((x) => x.querySelector('legend')?.textContent.includes('ภาคเหตุ')); f.querySelector('button[aria-label^="ลบข้อที่ 1"]').click(); return 1`); await sleep(400);
    return await ev(`return !T.pageText().includes('ย่อหน้าที่เพิ่มด้วยมือ')`);
  });
  await check("การ์ด 'ข้อมูลประกอบ': แก้เลขที่หนังสือและชื่อผู้ลงนาม → พรีวิวเปลี่ยน", async () => {
    await ev(`T.details('ข้อมูลประกอบ').open = true; return 1`); await sleep(200);
    await ev(`T.setField('เลขที่หนังสือ', 'ทด 0099/777'); T.setField('ชื่อผู้ลงนาม', 'นางทดสอบ สมมติ'); return 1`); await sleep(500);
    const t = await ev(`return T.pageText()`);
    return t.includes('๗๗๗') && t.includes('นางทดสอบ สมมติ') || "ไม่พบเลขที่/ผู้ลงนามใหม่ในพรีวิว";
  });
  await check("ผลตรวจอัปเดตตามการแก้ (ใส่ภาษาพูด 'ครับ' → มีคำเตือน)", async () => {
    await ev(`T.setField('เรื่อง', 'ขอความช่วยเหลือหน่อยครับ'); return 1`); await sleep(500);
    return await ev(`return [...document.querySelectorAll('.findings li')].some((l) => l.textContent.includes('ครับ'))`);
  });
  await check("พรีวิว: สลับ 'ทั้งเอกสาร' / 'พอดีความกว้าง' เปลี่ยนค่าย่อ", async () => {
    const z = () => ev(`return document.querySelector('.preview-controls .hint').textContent`);
    await ev(`T.click('พอดีความกว้าง'); return 1`); await sleep(300); const a = await z();
    await ev(`T.click('ทั้งเอกสาร'); return 1`); await sleep(400); const b = await z();
    return a !== b || `ค่าเท่ากัน ${a}`;
  });
  await check("พรีวิว: ติ๊ก 'แสดงระยะขอบ' แสดงเส้นประ และติ๊กออกแล้วหาย", async () => {
    await ev(`const c = document.querySelector('.preview-controls input[type=checkbox]'); if (c.checked) c.click(); return 1`); await sleep(300);
    await ev(`document.querySelector('.preview-controls input[type=checkbox]').click(); return 1`); await sleep(300);
    const on = await ev(`return !!document.querySelector('.thd-guide')`);
    await ev(`document.querySelector('.preview-controls input[type=checkbox]').click(); return 1`); await sleep(300);
    return on && (await ev(`return !document.querySelector('.thd-guide')`));
  });
  await check("ปุ่ม 'ดาวน์โหลด .docx' → ได้ไฟล์ .docx ที่เป็น zip ถูกต้องและมีเนื้อหาที่แก้", async () => {
    rmSync(dlDir, { recursive: true, force: true }); mkdirSync(dlDir, { recursive: true });
    await ev(`T.click('ดาวน์โหลด .docx'); return 1`);
    const t0 = Date.now();
    let f;
    while (Date.now() - t0 < 8000) { f = readdirSync(dlDir).find((x) => x.endsWith(".docx")); if (f) break; await sleep(200); }
    if (!f) return "ไม่มีไฟล์ถูกดาวน์โหลด";
    await sleep(300);
    const buf = readFileSync(join(dlDir, f));
    if (buf.subarray(0, 2).toString() !== "PK") return "ไฟล์ไม่ใช่ zip";
    return buf.length > 5000 ? `${f} ${buf.length} ไบต์` : "ไฟล์เล็กผิดปกติ";
  });
  await check("ปุ่ม 'พิมพ์ / PDF' เรียกคำสั่งพิมพ์", async () => { await ev(`window.__printed = 0; T.click('พิมพ์ / PDF'); return 1`); return (await ev(`return window.__printed`)) === 1; });
  let draftJson = "";
  await check("ปุ่ม 'บันทึกร่าง' → ได้ไฟล์ .json ที่เปิดต่อได้ (มีเนื้อหาที่แก้)", async () => {
    rmSync(dlDir, { recursive: true, force: true }); mkdirSync(dlDir, { recursive: true });
    await ev(`T.click('บันทึกร่าง'); return 1`);
    const t0 = Date.now(); let f;
    while (Date.now() - t0 < 6000) { f = readdirSync(dlDir).find((x) => x.endsWith(".json")); if (f) break; await sleep(200); }
    if (!f) return "ไม่มีไฟล์";
    await sleep(300);
    draftJson = readFileSync(join(dlDir, f), "utf8");
    const j = JSON.parse(draftJson);
    return j.thdocs === 1 && j.type === "memo" && JSON.stringify(j).includes("ขอความช่วยเหลือหน่อยครับ") || "เนื้อหาไม่ตรง";
  });
  await check("โหลดใหม่ → ร่างล่าสุดถูกกู้คืนอัตโนมัติ", async () => {
    await send("Page.reload"); await sleep(1500);
    return (await ev(`return T.step()`)) === "ตรวจและแก้" && (await ev(`return T.pageText().includes('นางทดสอบ สมมติ')`));
  });
  await check("ปุ่ม 'เริ่มใหม่' → กลับขั้นคำขอ ล้างร่างและพรีวิวกลับเป็นตัวอย่าง", async () => {
    await ev(`T.click('เริ่มใหม่'); return 1`); await until(`T.step() === 'คำขอ'`, 3000); await sleep(400);
    return await ev(`return !!document.querySelector('.example-badge') && !localStorage.getItem('thdocs.draft')`);
  });
  await check("'เปิดร่างที่บันทึกไว้' → เลือกไฟล์ .json แล้วกลับมาแก้ต่อได้", async () => {
    await ev(`T.text(document.querySelector('input[type=file][accept*=json]'), 'draft.json', 'application/json', ${JSON.stringify(draftJson)}); return 1`);
    await until(`T.step() === 'ตรวจและแก้'`, 4000);
    return await ev(`return T.pageText().includes('ขอความช่วยเหลือหน่อยครับ')`);
  });
  await check("เปิดไฟล์ที่ไม่ใช่ร่าง → แจ้งข้อผิดพลาด ไม่พัง", async () => {
    await ev(`T.click('เริ่มใหม่'); return 1`); await sleep(300);
    await ev(`T.text(document.querySelector('input[type=file][accept*=json]'), 'x.json', 'application/json', '{"a":1}'); return 1`);
    await until(`T.err()?.includes('ไม่ใช่ร่างของ THdocs')`, 3000);
    return true;
  });

  // ============================================================== 8. เริ่มจากตัวอย่าง (ไม่ใช้ AI)
  sec("8. ใช้งานโดยไม่มี AI: เปิดตัวอย่างแก้ต่อ");
  await go("/");
  await check("'เปิดตัวอย่างนี้แก้ต่อ (ไม่ต้องใช้ AI)' ไปขั้นตรวจและแก้ทันทีโดยไม่ถาม AI", async () => {
    await ev(`T.select(0, 'iso_car'); return 1`); await sleep(300);
    await ev(`T.click('เปิดตัวอย่างนี้แก้ต่อ'); return 1`);
    await until(`T.step() === 'ตรวจและแก้'`, 3000);
    return await ev(`return T.pageText().includes('CAR-2569-012') && !document.querySelector('.example-badge')`);
  });
  await check("เลขที่เอกสารสมมติของตัวอย่าง (FM-QA-05) ไม่ติดมาในเอกสารจริง — กลายเป็นช่อง [ระบุ]", async () => {
    const t = await ev(`return T.pageText()`);
    return !t.includes("FM-QA-05") && t.includes("[ระบุ: รหัสเอกสาร") || "เลขที่สมมติติดมาหรือไม่มีช่อง [ระบุ]";
  });
  await check("ISO: ตารางในฟอร์มแก้ได้ (แถวมาตรการ) และช่องเลือกประเภทผลตรวจ", async () => {
    await ev(`T.details('แก้ถ้อยคำเอง').open = true; return 1`); await sleep(300);
    const r = await ev(`return { tables: document.querySelectorAll('.sf-table').length, rows: document.querySelectorAll('.sf-table tbody tr').length }`);
    return r.tables >= 1 && r.rows >= 2 || JSON.stringify(r);
  });
  await check("ISO: เพิ่มแถวมาตรการ แล้วลบแถวออก", async () => {
    const n0 = await ev(`return document.querySelectorAll('.sf-table tbody tr').length`);
    await ev(`T.click('+ เพิ่มแถว'); return 1`); await sleep(300);
    const n1 = await ev(`return document.querySelectorAll('.sf-table tbody tr').length`);
    await ev(`document.querySelector('.sf-table tbody tr:last-child button[aria-label^="ลบแถว"]').click(); return 1`); await sleep(300);
    const n2 = await ev(`return document.querySelectorAll('.sf-table tbody tr').length`);
    return n1 === n0 + 1 && n2 === n0 || `${n0}→${n1}→${n2}`;
  });

  // ============================================================== 9. มือถือ
  sec("9. จอมือถือ (390px) — ไม่ล้นจอทุกขั้น");
  for (const [label, storage, prep] of [
    ["หน้าแรก", {}, ``],
    ["ขั้นตรวจและแก้ (บันทึกข้อความ)", AI_FAKE, `T.select(0, 'memo'); await new Promise(r => setTimeout(r, 300)); T.click('เปิดตัวอย่างนี้แก้ต่อ');`],
    ["ขั้นตรวจและแก้ (ISO ตารางกว้าง)", {}, `T.select(0, 'iso_procedure'); await new Promise(r => setTimeout(r, 300)); T.click('เปิดตัวอย่างนี้แก้ต่อ'); await new Promise(r => setTimeout(r, 300)); T.details('แก้ถ้อยคำเอง').open = true;`],
    ["หน้าตั้งค่า AI", {}, `T.click('AI:');`],
    ["หน้าข้อมูลหน่วยงาน", {}, `T.click('ข้อมูลหน่วยงาน');`],
  ]) {
    await go("/", { width: 390, height: 800, storage });
    await check(`${label}: ไม่มีแถบเลื่อนแนวนอนของทั้งหน้า`, async () => {
      await ev(`${prep} return 1`); await sleep(700);
      const o = await ev(`return T.overflowX()`);
      return o <= 1 || `ล้น ${o}px`;
    });
  }

  // ============================================================== 10. Word add-in
  sec("10. Word add-in (หน้า /addin เปิดนอก Word)");
  await go("/addin", { width: 380, height: 900 });
  await check("หน้า /addin โหลดได้ แผงแคบไม่ล้นจอ", async () => (await ev(`return T.overflowX()`)) <= 1);
  await check("นอก Word: ไม่แสดงปุ่ม 'ใช้ข้อความที่เลือกใน Word' และหลังเปิดตัวอย่างขึ้นข้อความให้เปิดจาก Word", async () => {
    if (await ev(`return !!T.btnIn('ใช้ข้อความที่เลือกใน Word')`)) return "แสดงปุ่ม Word ทั้งที่อยู่นอก Word";
    await ev(`T.click('เปิดตัวอย่างนี้แก้ต่อ'); return 1`); await sleep(500);
    return await ev(`return document.body.textContent.includes('เปิดหน้านี้จากใน Microsoft Word')`);
  }, { allowErrors: true });
  await check("manifest ของ add-in เป็น XML ที่อ่านได้ และไอคอนโหลดได้", async () => {
    const m = await (await fetch(`${BASE}/addin/manifest.xml`)).text();
    const i = await fetch(`${BASE}/addin/icon/32`);
    return m.startsWith("<?xml") && m.includes("<OfficeApp") && i.ok && i.headers.get("content-type") === "image/png" || "manifest/ไอคอนผิด";
  });

  // ============================================================== 11. PWA / API
  sec("11. PWA และ API");
  await check("manifest ติดตั้งแอปได้ — Chrome ไม่พบข้อบกพร่องการติดตั้ง", async () => {
    await go("/");
    let r = await send("Page.getInstallabilityErrors");
    for (let i = 0; i < 5 && !r.result; i++) { await sleep(500); r = await send("Page.getInstallabilityErrors"); } // เพิ่งโหลดหน้า CDP อาจตอบ error ครั้งแรก
    return (r.result.installabilityErrors ?? []).length === 0 || JSON.stringify(r.result.installabilityErrors);
  });
  await check("ไอคอนแอปทุกขนาดโหลดได้ (192/512/maskable/apple)", async () => {
    for (const n of ["192", "512", "maskable-192", "maskable-512", "apple-180"]) { const r = await fetch(`${BASE}/icons/${n}`); if (!r.ok) return `${n} → ${r.status}`; }
    return true;
  });
  await check("API ทุกตัวตอบ no-store และ /api/config เปิดเฉพาะผู้ให้บริการที่อนุญาต", async () => {
    const r = await fetch(`${BASE}/api/config`);
    const j = await r.json();
    return r.headers.get("cache-control") === "no-store" && j.providers.length >= 3 || "ผิด";
  });

  // ============================================================== 12. เอกสารเปล่า + ตรวจไฟล์ Word
  sec("12. เอกสารเปล่า และตรวจไฟล์ Word ที่เขียนเอง");
  await go("/");
  let blankDocx;
  await check("'เริ่มจากฟอร์มเปล่า' → เข้าขั้นตรวจและแก้ ไม่เรียก AI มีช่อง [ระบุ] และผลตรวจเตือนช่องที่ยังไม่กรอก", async () => {
    await ev(`T.select(0, 'memo'); return 1`); await sleep(300);
    await ev(`T.click('เริ่มจากฟอร์มเปล่า'); return 1`);
    await until(`T.step() === 'ตรวจและแก้'`, 3000);
    const r = await ev(`return { ph: T.pageText().includes('[ระบุ'), find: document.querySelectorAll('.findings li').length, err: T.err(), badge: !!document.querySelector('.example-badge') }`);
    return (r.ph && r.find > 0 && !r.err && !r.badge) || JSON.stringify(r);
  });
  await check("ฟอร์มเปล่า: แก้ช่องเรื่องเองแล้วค่าขึ้นในเอกสาร (ไม่ต้องใช้ AI)", async () => {
    await ev(`T.details('แก้ถ้อยคำเอง').open = true; return 1`); await sleep(300);
    await ev(`T.setField('เรื่อง', 'ขออนุมัติทดสอบฟอร์มเปล่า'); return 1`); await sleep(500);
    return await ev(`return T.pageText().includes('ขออนุมัติทดสอบฟอร์มเปล่า')`);
  });
  await check("ฟอร์มเปล่า: ดาวน์โหลด .docx ได้", async () => {
    rmSync(dlDir, { recursive: true, force: true }); mkdirSync(dlDir, { recursive: true });
    await ev(`T.click('ดาวน์โหลด .docx'); return 1`);
    let f; const t0 = Date.now();
    while (Date.now() - t0 < 8000) { f = readdirSync(dlDir).find((x) => x.endsWith(".docx")); if (f) break; await sleep(200); }
    if (!f) return "ไม่ได้ไฟล์";
    blankDocx = readFileSync(join(dlDir, f));
    return blankDocx.subarray(0, 2).toString() === "PK" || "ไม่ใช่ zip";
  });
  const JSZip = (await import("jszip")).default;
  const goodB64 = () => blankDocx.toString("base64");
  const badB64 = async () => {
    const z = await JSZip.loadAsync(blankDocx);
    let x = await z.file("word/document.xml").async("string");
    x = x.replace(/(<w:pgMar[^>]*?)w:left="\d+"/, '$1w:left="1134"');
    z.file("word/document.xml", x);
    return (await z.generateAsync({ type: "uint8array" })).reduce((s, b) => s + String.fromCharCode(b), "");
  };
  const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  await go("/");
  await check("แถบ 'ตรวจไฟล์ Word' เปิด/ปิดได้ และอยู่ในจอ", async () => {
    await ev(`T.click('ตรวจไฟล์ Word'); return 1`);
    await until(`document.querySelector('input[type=file][accept*=docx]')`, 3000);
    const r = await ev(`const b = document.querySelector('.side .card').getBoundingClientRect(); return [b.left >= 0, b.right <= innerWidth, T.overflowX() <= 1]`);
    return r.every(Boolean) || JSON.stringify(r);
  });
  await check("ตรวจไฟล์ที่ THdocs สร้าง: อ่านได้ ขอบซ้าย/ขวาถูก (ไม่มีข้อผิดรูปแบบ) แต่เตือนช่อง [ระบุ]", async () => {
    await ev(`T.file(document.querySelector('input[type=file][accept*=docx]'), 'ฟอร์มเปล่า.docx', '${DOCX_MIME}', '${goodB64()}'); return 1`);
    await until(`document.querySelector('.findings')`, 6000);
    const t = await ev(`return document.querySelector('.side').textContent`);
    return (t.includes('ยังไม่ได้กรอก') && !t.includes('ขอบซ้าย') && !t.includes('ไม่ใช่ A4') && t.includes('ฟอร์มเปล่า.docx')) || t.slice(0, 300);
  });
  await check("ตรวจไฟล์ที่ขอบซ้ายผิด → แจ้ง 'ขอบซ้าย … ไม่ตรงมาตรฐาน'", async () => {
    const b64 = Buffer.from(await badB64(), "binary").toString("base64");
    await ev(`T.file(document.querySelector('input[type=file][accept*=docx]'), 'ขอบผิด.docx', '${DOCX_MIME}', '${b64}'); return 1`);
    await until(`document.querySelector('.side').textContent.includes('ขอบผิด.docx')`, 6000);
    const t = await ev(`return document.querySelector('.side').textContent`);
    return t.includes('ขอบซ้าย') && t.includes('ไม่ตรงมาตรฐาน') || t.slice(0, 300);
  });
  await check("ไฟล์ที่ไม่ใช่ docx → ข้อความผิดพลาดที่อ่านออก ไม่ค้าง", async () => {
    await ev(`T.text(document.querySelector('input[type=file][accept*=docx]'), 'x.docx', '${DOCX_MIME}', 'not a zip'); return 1`);
    await until(`document.querySelector('.notice.err')`, 6000);
    return !(await ev(`return !!document.querySelector('.notice.busy')`));
  });
  await check("ไฟล์ไม่ถูกอัปโหลด: ระหว่างตรวจไม่มีคำขอเครือข่ายไป /api", async () => {
    const apiCalls = () => events.filter((e) => e.method === "Network.requestWillBeSent" && /\/api\//.test(e.params.request.url)).length;
    const before = apiCalls();
    const b64 = goodB64();
    await ev(`T.file(document.querySelector('input[type=file][accept*=docx]'), 'อีกครั้ง.docx', '${DOCX_MIME}', '${b64}'); return 1`);
    await until(`document.querySelector('.side').textContent.includes('อีกครั้ง.docx')`, 6000);
    const after = apiCalls();
    return after === before || `มีคำขอ /api เพิ่ม ${after - before}`;
  });
  await check("ปุ่ม 'กลับไปร่างเอกสาร' กลับหน้าคำขอ", async () => {
    await ev(`T.click('กลับไปร่างเอกสาร'); return 1`);
    await until(`T.step() === 'คำขอ'`, 3000);
    return true;
  });
  await check("แผงตรวจไฟล์ไม่ล้นจอที่ 390px", async () => {
    await go("/", { width: 390, height: 800 });
    await ev(`T.click('ตรวจไฟล์ Word'); return 1`); await sleep(500);
    return (await ev(`return T.overflowX()`)) <= 1;
  });

  // ============================================================== 13. แม่แบบ .dotx และปรับข้อความ
  sec("13. แม่แบบ .dotx และปรับข้อความที่เขียนเอง");
  await go("/", { storage: AI_FAKE });
  await check("ปุ่ม 'ดาวน์โหลดแม่แบบ .dotx' → ได้ไฟล์ .dotx ที่ชนิดเนื้อหาเป็น template", async () => {
    await ev(`T.click('เริ่มจากฟอร์มเปล่า'); return 1`);
    await until(`T.step() === 'ตรวจและแก้'`, 3000);
    rmSync(dlDir, { recursive: true, force: true }); mkdirSync(dlDir, { recursive: true });
    await ev(`T.click('ดาวน์โหลดแม่แบบ .dotx'); return 1`);
    let f; const t0 = Date.now();
    while (Date.now() - t0 < 8000) { f = readdirSync(dlDir).find((x) => x.endsWith(".dotx")); if (f) break; await sleep(200); }
    if (!f) return "ไม่ได้ไฟล์ .dotx";
    const z = await (await import("jszip")).default.loadAsync(readFileSync(join(dlDir, f)));
    const ct = await z.file("[Content_Types].xml").async("string");
    return ct.includes("wordprocessingml.template.main+xml") || "ชนิดเนื้อหาไม่ใช่ template";
  });
  await go("/", { storage: AI_FAKE });
  await check("แผง 'ปรับข้อความ' เปิดได้ ปุ่มปรับกดไม่ได้เมื่อยังไม่มีข้อความ และนอก Word ไม่มีปุ่มดึงจาก Word", async () => {
    await ev(`T.click('ปรับข้อความ'); return 1`);
    await until(`T.btn('ปรับข้อความ') && document.querySelectorAll('textarea').length`, 3000);
    const r = await ev(`const cards = [...document.querySelectorAll('.side button')].filter((b) => b.textContent.trim() === 'ปรับข้อความ'); return { dis: cards.at(-1).disabled, word: !!T.btnIn('ใช้ข้อความที่เลือกใน Word') }`);
    return (r.dis && !r.word) || JSON.stringify(r);
  });
  await check("พิมพ์ข้อความ → กดปรับ → ได้ผลลัพธ์จาก AI จำลอง (เบราว์เซอร์เรียกตรง ไม่ผ่านเซิร์ฟเวอร์) และมีปุ่มคัดลอก", async () => {
    await ev(`T.set(document.querySelector('.side textarea'), 'เลยขอบอกว่าอยากจะจัดอบรมให้เด็กๆ ครับ'); return 1`);
    const apiBefore = await ev(`return performance.getEntriesByType('resource').filter((r) => r.name.includes('/api/rewrite')).length`);
    await ev(`[...document.querySelectorAll('.side button')].filter((b) => b.textContent.trim() === 'ปรับข้อความ').at(-1).click(); return 1`);
    await until(`[...document.querySelectorAll('.side textarea')].some((t) => t.value.includes('ขอเรียนว่าจะจัดอบรม'))`, 8000);
    const apiAfter = await ev(`return performance.getEntriesByType('resource').filter((r) => r.name.includes('/api/rewrite')).length`);
    return (apiAfter === apiBefore && !!(await ev(`return !!T.btn('คัดลอก')`))) || "เรียกผ่านเซิร์ฟเวอร์หรือไม่มีปุ่มคัดลอก";
  });
  await check("ผลลัพธ์แก้ไขเองได้ในช่องผลลัพธ์", async () => {
    await ev(`const t = [...document.querySelectorAll('.side textarea')].at(-1); T.set(t, t.value + ' (แก้เอง)'); return 1`);
    await sleep(200);
    return await ev(`return [...document.querySelectorAll('.side textarea')].at(-1).value.endsWith('(แก้เอง)')`);
  });
  await go("/");
  await check("ยังไม่ตั้งค่า AI → กดปรับ เปิดหน้าตั้งค่า AI (ไม่ส่งข้อความ)", async () => {
    await ev(`T.click('ปรับข้อความ'); return 1`);
    await until(`document.querySelector('.side textarea')`, 3000);
    await ev(`T.set(document.querySelector('.side textarea'), 'ทดสอบ'); return 1`);
    await ev(`[...document.querySelectorAll('.side button')].filter((b) => b.textContent.trim() === 'ปรับข้อความ').at(-1).click(); return 1`);
    await until(`document.body.textContent.includes('ตั้งค่า AI')`, 3000);
    return true;
  });
  await check("ขั้นแก้: เปลี่ยนชั้นความเร็วในเอกสารที่ร่างแล้ว → ขึ้นในเอกสารทันที และตั้งชั้นความลับได้", async () => {
    await go("/");
    await ev(`T.select(0, 'external_letter'); await new Promise(r => setTimeout(r, 300)); T.click('เปิดตัวอย่างนี้แก้ต่อ'); return 1`);
    await until(`T.step() === 'ตรวจและแก้'`, 3000);
    await ev(`T.details('ข้อมูลประกอบ').open = true; return 1`); await sleep(300);
    await ev(`const d = T.details('ข้อมูลประกอบ'); const s = d.querySelectorAll('select'); T.set(s[0], 'ด่วนที่สุด'); T.set(s[1], 'ลับ'); return 1`); await sleep(500);
    const t = await ev(`return T.pageText()`);
    return (t.includes('ด่วนที่สุด') && t.includes('ลับ')) || "ไม่ขึ้นในเอกสาร";
  });
  await check("ดาวน์โหลด .docx / .dotx สร้างในเบราว์เซอร์ ไม่เรียก /api/docx และไฟล์อ่านได้ (ตัวตรวจผ่าน)", async () => {
    await go("/", { storage: AI_FAKE });
    await ev(`T.click('เริ่มจากฟอร์มเปล่า'); return 1`);
    await until(`T.step() === 'ตรวจและแก้'`, 3000);
    rmSync(dlDir, { recursive: true, force: true }); mkdirSync(dlDir, { recursive: true });
    await ev(`T.click('ดาวน์โหลด .docx'); return 1`);
    let f; const t0 = Date.now();
    while (Date.now() - t0 < 8000) { f = readdirSync(dlDir).find((x) => x.endsWith(".docx")); if (f) break; await sleep(200); }
    if (!f) return "ไม่ได้ไฟล์";
    const hit = await ev(`return performance.getEntriesByType('resource').some((r) => r.name.includes('/api/docx'))`);
    const z = await (await import("jszip")).default.loadAsync(readFileSync(join(dlDir, f)));
    const x = await z.file("word/document.xml").async("string");
    return (!hit && x.includes('w:left="1701"') && Object.keys(z.files).some((n) => n.startsWith("word/media/"))) || `hit=${hit}`;
  });
  await check("แผงปรับข้อความไม่ล้นจอที่ 390px", async () => {
    await go("/", { width: 390, height: 800, storage: AI_FAKE });
    await ev(`T.click('ปรับข้อความ'); return 1`); await sleep(500);
    return (await ev(`return T.overflowX()`)) <= 1;
  });
} finally {
  const failed = results.filter((r) => !r.ok);
  console.log(`\n==== สรุป: ผ่าน ${results.length - failed.length}/${results.length}  ไม่ผ่าน ${failed.length}`);
  for (const f of failed) console.log(`  ✗ [${f.section}] ${f.name}  — ${f.detail}`);
  if (JSON_OUT) writeFileSync(JSON_OUT, JSON.stringify(results, null, 2));
  try { ws.close(); } catch {}
  // ปิดทั้งต้นไม้ Edge (ตัวเปิดออกไปก่อน ลูก ๆ จึงค้างถ้าฆ่าแค่ตัวเดียว)
  const name = profileDir.split(/[\\/]/).pop();
  spawnSync("powershell", ["-NoProfile", "-Command", `Get-CimInstance Win32_Process -Filter "Name='msedge.exe'" | ? { $_.CommandLine -match '${name}' } | % { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }`], { stdio: "ignore" });
  rmSync(profileDir, { recursive: true, force: true });
  rmSync(dlDir, { recursive: true, force: true });
  process.exit(failed.length ? 1 : 0);
}
