/**
 * ทดสอบ API ของเว็บโดยเรียก route handler ตรง (ไม่ต้องเปิดเซิร์ฟเวอร์) — AI เป็นตัวจำลอง ไม่มีการเรียกเครือข่ายจริง
 * เน้นระบบป้องกัน: สิทธิ์ใช้ key, SSRF, หนังสือลับ, ตราจากผู้ใช้, ขนาดคำขอ, จำกัดอัตรา, การปิดบังข้อมูลส่วนบุคคล
 */
import JSZip from "jszip";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MockLLM } from "@thdocs/llm";
import { ISO_SAMPLES, PROFILE, SAMPLES } from "../examples/samples";

// คิวคำตอบของ AI จำลอง — ผู้ให้บริการในเครื่อง (ollama/lmstudio) = ไม่ออกนอกเครื่อง ที่เหลือ = ภายนอก
const llmState = vi.hoisted(() => ({ queue: [] as unknown[], created: [] as { provider: string; apiKey?: string; model?: string }[] }));

vi.mock("@thdocs/llm", async (importOriginal) => {
  const orig = await importOriginal<typeof import("@thdocs/llm")>();
  return {
    ...orig,
    createLLM: (cfg: { provider: string; apiKey?: string; model?: string }) => {
      llmState.created.push(cfg);
      return new orig.MockLLM(llmState.queue, !["ollama", "lmstudio"].includes(cfg.provider));
    },
  };
});

type Handler = (req: Request) => Promise<Response>;
interface Routes {
  config: { GET: () => Response };
  facts: { POST: Handler };
  draft: { POST: Handler };
  revise: { POST: Handler };
  docx: { POST: Handler };
}

let ipCounter = 0;
const post = (body: unknown, ip = `10.0.0.${++ipCounter}`) =>
  new Request("http://localhost/api/x", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-forwarded-for": ip },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });

/** โหลด route ใหม่ทุกครั้งหลังตั้ง env — นโยบายอ่านค่าตอนโหลดโมดูล */
async function load(env: Record<string, string> = {}): Promise<Routes> {
  vi.resetModules();
  for (const k of ["THDOCS_SERVER_KEYS", "THDOCS_ALLOW_CUSTOM_URL", "THDOCS_OLLAMA_URL", "THDOCS_LMSTUDIO_URL", "THDOCS_RATE_LIMIT", "ANTHROPIC_API_KEY", "OPENAI_API_KEY"]) {
    vi.stubEnv(k, "");
  }
  for (const [k, v] of Object.entries(env)) vi.stubEnv(k, v);
  const base = "../apps/web/app/api";
  return {
    config: await import(`${base}/config/route`),
    facts: await import(`${base}/facts/route`),
    draft: await import(`${base}/draft/route`),
    revise: await import(`${base}/revise/route`),
    docx: await import(`${base}/docx/route`),
  };
}

const memoWording = SAMPLES.memo!.wording;
const EXTERNAL = { provider: "openai", model: "gpt-x", apiKey: "sk-test" };
const LOCAL = { provider: "ollama", model: "qwen3.5:9b" };

beforeEach(() => {
  llmState.queue = [];
  llmState.created = [];
});
afterEach(() => vi.unstubAllEnvs());

describe("/api/config — ผู้ให้บริการที่เปิดให้ใช้", () => {
  it("production: ไม่มี AI ในเครื่องและไม่มี custom URL ถ้าไม่ตั้งค่าไว้", async () => {
    const r = await load({ NODE_ENV: "production" });
    const { providers } = (await r.config.GET().json()) as { providers: { id: string; external: boolean; needsKey: boolean }[] };
    expect(providers.map((p) => p.id).sort()).toEqual(["anthropic", "gemini", "openai"]);
    expect(providers.every((p) => p.external && p.needsKey)).toBe(true);
  });

  it("เปิด ollama ได้เมื่อกำหนด URL, custom เมื่อเปิดสวิตช์เท่านั้น, และ key ของเซิร์ฟเวอร์ใช้ได้เมื่อเปิดสวิตช์", async () => {
    const r = await load({ NODE_ENV: "production", THDOCS_OLLAMA_URL: "http://10.1.1.1:11434/v1", THDOCS_ALLOW_CUSTOM_URL: "1", THDOCS_SERVER_KEYS: "1", ANTHROPIC_API_KEY: "sk-server" });
    const { providers } = (await r.config.GET().json()) as { providers: { id: string; external: boolean; needsKey: boolean }[] };
    const by = Object.fromEntries(providers.map((p) => [p.id, p]));
    expect(by.ollama).toMatchObject({ external: false, needsKey: false });
    expect(by.custom).toBeDefined();
    expect(by.anthropic!.needsKey).toBe(false); // มี key ของเซิร์ฟเวอร์
    expect(by.openai!.needsKey).toBe(true); // ไม่มี key ของ OpenAI ในเซิร์ฟเวอร์
  });
});

describe("นโยบายผู้ให้บริการ AI", () => {
  it("SSRF: ผู้ใช้สั่ง custom + URL ภายในไม่ได้ (ปิดไว้ตั้งต้น) และไม่มีการสร้าง client", async () => {
    const r = await load({ NODE_ENV: "production" });
    const res = await r.facts.POST(post({ type: "memo", request: "x", options: {}, llm: { provider: "custom", model: "m", baseUrl: "http://169.254.169.254/v1" } }));
    expect(res.status).toBe(400);
    expect(llmState.created).toHaveLength(0);
  });

  it("ไม่ใส่ API key → 400 และไม่แอบใช้ key ของเซิร์ฟเวอร์ (เมื่อไม่ได้เปิดสวิตช์)", async () => {
    const r = await load({ NODE_ENV: "production", ANTHROPIC_API_KEY: "sk-server-secret" });
    const res = await r.facts.POST(post({ type: "memo", request: "x", options: {}, llm: { provider: "anthropic" } }));
    expect(res.status).toBe(400);
    expect(JSON.stringify(await res.json())).not.toContain("sk-server-secret");
    expect(llmState.created).toHaveLength(0);
  });

  it("ต้องระบุชื่อโมเดลสำหรับ openai", async () => {
    const r = await load({ NODE_ENV: "production" });
    const res = await r.facts.POST(post({ type: "memo", request: "x", options: {}, llm: { provider: "openai", apiKey: "sk-test" } }));
    expect(res.status).toBe(400);
  });

  it("ollama ในเครื่องใช้ไม่ได้บน production ถ้าไม่ตั้ง THDOCS_OLLAMA_URL", async () => {
    const r = await load({ NODE_ENV: "production" });
    const res = await r.facts.POST(post({ type: "memo", request: "x", options: {}, llm: LOCAL }));
    expect(res.status).toBe(400);
  });
});

describe("หนังสือชั้นความลับ", () => {
  const secret = { options: { secrecy: "ลับ" }, profile: PROFILE };

  it.each([
    ["facts", (r: Routes) => r.facts.POST(post({ type: "memo", request: "เรื่องลับ", ...secret, llm: EXTERNAL }))],
    ["draft", (r: Routes) => r.draft.POST(post({ type: "memo", request: "เรื่องลับ", facts: {}, ...secret, llm: EXTERNAL }))],
    ["revise", (r: Routes) => r.revise.POST(post({ file: { ...SAMPLES.memo, options: { secrecy: "ลับมาก" } }, instruction: "แก้", profile: PROFILE, llm: EXTERNAL }))],
  ])("%s: ส่งให้ AI ภายนอกไม่ได้ → 403 และ AI ไม่ถูกเรียกเลย", async (_n, call) => {
    const r = await load({ NODE_ENV: "production" });
    llmState.queue.push(memoWording);
    const res = await call(r);
    expect(res.status).toBe(403);
    expect(llmState.queue).toHaveLength(1); // ไม่ถูกดึงไปใช้
  });

  it("AI ในเครื่องใช้กับหนังสือลับได้ และชั้นความลับคงอยู่ในไฟล์ร่าง", async () => {
    const r = await load({ NODE_ENV: "production", THDOCS_OLLAMA_URL: "http://10.1.1.1:11434/v1" });
    llmState.queue.push(memoWording);
    const res = await r.draft.POST(post({ type: "memo", request: "เรื่องลับ", facts: { recipient: "ผู้อำนวยการ" }, ...secret, llm: LOCAL }));
    expect(res.status).toBe(200);
    const { file, masked } = (await res.json()) as { file: { options: { secrecy: string } }; masked: string };
    expect(file.options.secrecy).toBe("ลับ");
    expect(masked).toBe(""); // AI ในเครื่อง: ไม่ต้องปิดบัง
  });
});

describe("การปิดบังข้อมูลส่วนบุคคลผ่าน API", () => {
  it("AI ภายนอกไม่เห็นข้อมูลจริง แต่เอกสารได้ค่าจริงกลับ และรายงานสิ่งที่ปิดบัง", async () => {
    const r = await load({ NODE_ENV: "production" });
    const seen: string[] = [];
    const orig = MockLLM.prototype.generateJson;
    const spy = vi.spyOn(MockLLM.prototype, "generateJson").mockImplementation(function (this: MockLLM, req) {
      seen.push(req.system + req.user);
      return orig.call(this, req);
    });
    llmState.queue.push({ body: ["หนังสือฉบับนี้ให้ไว้เพื่อรับรองว่า ⟦ชื่อ1⟧ เป็นพนักงาน โทร ⟦โทร1⟧"] });
    const res = await r.draft.POST(
      post({
        type: "certificate",
        request: "ออกหนังสือรับรองให้ นางสาวสมหญิง ใจดี โทร 081-234-5678",
        facts: { personName: "นางสาวสมหญิง ใจดี" },
        profile: PROFILE,
        options: {},
        llm: EXTERNAL,
      }),
    );
    spy.mockRestore();
    expect(res.status).toBe(200);
    expect(seen.join("")).not.toMatch(/สมหญิง|081-234/);
    const out = (await res.json()) as { file: { wording: { body: string[] } }; masked: string };
    expect(out.file.wording.body[0]).toContain("นางสาวสมหญิง ใจดี");
    expect(out.file.wording.body[0]).toContain("081-234-5678");
    expect(out.masked).toMatch(/ชื่อ 1/);
    expect(out.masked).toMatch(/โทร 1/);
  });
});

describe("ตรวจคำขอ", () => {
  it("JSON เสีย → 400, ชนิดเอกสารไม่รู้จัก → 400, ฟิลด์ผิดประเภท → 400", async () => {
    const r = await load({ NODE_ENV: "production" });
    expect((await r.facts.POST(post("{ไม่ใช่ json"))).status).toBe(400);
    expect((await r.draft.POST(post({ type: "nope", request: "x", facts: {}, options: {}, llm: EXTERNAL }))).status).toBe(400);
    expect((await r.draft.POST(post({ type: "memo", request: 123, facts: {}, options: {}, llm: EXTERNAL }))).status).toBe(400);
    expect((await r.facts.POST(post({ type: "memo", request: "x", options: { secrecy: "ลับที่สุดยอด" }, llm: EXTERNAL }))).status).toBe(400);
  });

  it("คำขอใหญ่เกิน 1 MB → 413", async () => {
    const r = await load({ NODE_ENV: "production" });
    const res = await r.facts.POST(post(JSON.stringify({ type: "memo", request: "ก".repeat(1_100_000), options: {}, llm: EXTERNAL })));
    expect(res.status).toBe(413);
  });

  it("ข้อความข้อมูลที่ผู้ใช้กรอกยาวเกินกำหนด → 400", async () => {
    const r = await load({ NODE_ENV: "production" });
    const res = await r.draft.POST(post({ type: "memo", request: "x", facts: { recipient: "ก".repeat(5000) }, options: {}, llm: EXTERNAL }));
    expect(res.status).toBe(400);
  });

  it("ไฟล์ร่างที่ถ้อยคำไม่ตรง schema → 400 พร้อมบอกช่องที่ผิด ไม่ใช่ 500", async () => {
    const r = await load({ NODE_ENV: "production" });
    const res = await r.docx.POST(post({ file: { ...SAMPLES.memo, wording: { subject: "x" } }, profile: PROFILE }));
    expect(res.status).toBe(400);
    expect(((await res.json()) as { detail: string }).detail).toContain("memo");
  });
});

describe("จำกัดอัตรา", () => {
  it("เกินโควตาต่อ IP → 429 และ IP อื่นไม่โดนด้วย", async () => {
    const r = await load({ NODE_ENV: "production", THDOCS_RATE_LIMIT: "3" });
    const ask = (ip: string) => r.facts.POST(post({ type: "memo", request: "x", options: {}, llm: { provider: "custom" } }, ip));
    const codes = [];
    for (let i = 0; i < 5; i++) codes.push((await ask("203.0.113.7")).status);
    expect(codes.slice(0, 3)).not.toContain(429);
    expect(codes.slice(3)).toEqual([429, 429]);
    expect((await ask("203.0.113.8")).status).not.toBe(429);
  });
});

describe("ห้ามแคชผลลัพธ์ของ API", () => {
  it("ทุก route ตอบ Cache-Control: no-store ทั้งสำเร็จและผิดพลาด (ผลลัพธ์คือเนื้อหาเอกสาร)", async () => {
    const r = await load({ NODE_ENV: "production" });
    const responses = [
      r.config.GET(),
      await r.docx.POST(post({ file: SAMPLES.memo, profile: PROFILE })), // สำเร็จ
      await r.docx.POST(post("{ ไม่ใช่ json")), // ผิดพลาด
      await r.facts.POST(post({ type: "memo", request: "x", options: {}, llm: { provider: "custom" } })), // ถูกปฏิเสธ
    ];
    for (const res of responses) expect(res.headers.get("cache-control")).toBe("no-store");
  });
});

describe("ค่า env ว่าง (เช่น THDOCS_RATE_LIMIT= ในไฟล์ .env)", () => {
  it("ใช้ค่าตั้งต้น ไม่ใช่ 0 ที่จะปฏิเสธทุกคำขอ", async () => {
    const r = await load({ NODE_ENV: "production", THDOCS_RATE_LIMIT: "" });
    for (let i = 0; i < 10; i++) {
      const res = await r.facts.POST(post({ type: "memo", request: "x", options: {}, llm: { provider: "custom" } }, "198.51.100.1"));
      expect(res.status).not.toBe(429);
    }
  });

  it("THDOCS_OLLAMA_URL ว่างบน production = ไม่เปิด AI ในเครื่อง", async () => {
    const r = await load({ NODE_ENV: "production", THDOCS_OLLAMA_URL: "" });
    const { providers } = (await r.config.GET().json()) as { providers: { id: string }[] };
    expect(providers.map((p) => p.id)).not.toContain("ollama");
  });
});

describe("/api/docx", () => {
  it("สร้าง .docx จากไฟล์ร่าง (ไม่ต้องใช้ AI/key) พร้อมชื่อไฟล์ภาษาไทยที่ encode ถูก", async () => {
    const r = await load({ NODE_ENV: "production" });
    const res = await r.docx.POST(post({ file: SAMPLES.memo, profile: PROFILE }));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("wordprocessingml");
    expect(res.headers.get("content-disposition")).toContain(encodeURIComponent("บันทึกข้อความ"));
    const zip = await JSZip.loadAsync(new Uint8Array(await res.arrayBuffer()));
    expect(zip.file("word/document.xml")).toBeTruthy();
    expect(llmState.created).toHaveLength(0);
  });

  it("ทุกชุดแม่แบบ: ทุกชนิดสร้างได้ผ่าน API", async () => {
    const r = await load({ NODE_ENV: "production" });
    for (const f of [...Object.values(SAMPLES), ...Object.values(ISO_SAMPLES)]) {
      const profile = f.type.startsWith("iso_") ? { orgName: "บริษัท ตัวอย่าง จำกัด", unit: "ฝ่าย", address: [] } : PROFILE;
      const res = await r.docx.POST(post({ file: f, profile }));
      expect(res.status, f.type).toBe(200);
    }
  });

  it("ตราต้องเป็น PNG ในรูป data URL เท่านั้น: path บนเครื่อง/ไฟล์อื่น → ปฏิเสธ", async () => {
    const r = await load({ NODE_ENV: "production" });
    for (const emblem of ["C:/Windows/win.ini", "file:///etc/passwd", "data:text/html;base64,PHNjcmlwdD4="]) {
      const res = await r.docx.POST(post({ file: SAMPLES.memo, profile: PROFILE, emblem }));
      expect(res.status, emblem).toBe(400);
      // ถูกปฏิเสธตั้งแต่ด่านแรก (ก่อนถอดรหัส) — ไม่ใช่เพียงแค่ล้มทีหลังเพราะไม่ใช่ภาพ
      expect(((await res.json()) as { detail: string }).detail).toBe("ตราต้องเป็นไฟล์ PNG");
    }
  });

  it("emblemPng ในโปรไฟล์ถูกตัดทิ้ง ไม่อ่านไฟล์บนเซิร์ฟเวอร์ตาม path ที่ผู้ใช้ส่งมา", async () => {
    const r = await load({ NODE_ENV: "production" });
    const res = await r.docx.POST(post({ file: SAMPLES.memo, profile: { ...PROFILE, emblemPng: "C:/Windows/win.ini" } }));
    expect(res.status).toBe(200); // ถ้าอ่านจริงจะล้มเพราะไม่ใช่ PNG
  });

  it("PNG ที่ถูกต้องใช้เป็นตราได้ และ PNG เสียได้ 400 ไม่ใช่ 500", async () => {
    const r = await load({ NODE_ENV: "production" });
    const { placeholderPng } = await import("@thdocs/render-docx");
    const ok = `data:image/png;base64,${Buffer.from(placeholderPng()).toString("base64")}`;
    expect((await r.docx.POST(post({ file: SAMPLES.memo, profile: PROFILE, emblem: ok }))).status).toBe(200);
    const bad = `data:image/png;base64,${Buffer.from("ไม่ใช่ภาพ").toString("base64")}`;
    expect((await r.docx.POST(post({ file: SAMPLES.memo, profile: PROFILE, emblem: bad }))).status).toBe(400);
  });

  it("ระยะขอบที่ผู้ใช้ส่งมาผิดปกติ ใช้ค่าตั้งต้น ไม่พังและไม่ได้กระดาษเพี้ยน", async () => {
    const r = await load({ NODE_ENV: "production" });
    const res = await r.docx.POST(post({ file: SAMPLES.memo, profile: { ...PROFILE, margins: { "th-gov": { leftCm: -5, rightCm: 999 } } } }));
    expect(res.status).toBe(200);
    const xml = await (await JSZip.loadAsync(new Uint8Array(await res.arrayBuffer()))).file("word/document.xml")!.async("string");
    expect(xml).toContain(`w:left="${Math.round((3 * 1440) / 2.54)}"`);
  });
});

describe("ครบวงจร: ดึงข้อมูล → ร่าง → แก้ → .docx (AI จำลอง)", () => {
  it("ชั้นความเร็ว ผู้รับ และผู้ลงนามมาจากข้อมูลที่ผู้ใช้ให้ ไม่ใช่จาก AI", async () => {
    const r = await load({ NODE_ENV: "production" });
    llmState.queue.push({ recipient: "ผู้อำนวยการกองคลัง", purpose: "ขออนุมัติ", details: null, docNo: null, date: null, signerName: null, signerPosition: null });
    const f1 = await r.facts.POST(post({ type: "memo", request: "ขออนุมัติ เรียนผู้อำนวยการกองคลัง", profile: PROFILE, options: {}, llm: EXTERNAL }));
    expect(f1.status).toBe(200);
    const { facts, missing } = (await f1.json()) as { facts: Record<string, string | null>; missing: string[] };
    expect(missing).toEqual([]);

    llmState.queue.push({ ...(memoWording as object), recipient: "ผู้บังคับบัญชา (AI แต่งเอง)" });
    const d = await r.draft.POST(post({ type: "memo", request: "ขออนุมัติ", facts, profile: PROFILE, options: { speed: "ด่วน" }, llm: EXTERNAL }));
    expect(d.status).toBe(200);
    const { file } = (await d.json()) as { file: { options: { speed: string }; wording: Record<string, unknown> } };
    expect(file.options.speed).toBe("ด่วน");
    expect(JSON.stringify(file.wording)).not.toContain("ผู้บังคับบัญชา");

    llmState.queue.push({ ...(memoWording as object), subject: "เรื่องที่แก้แล้ว" });
    const v = await r.revise.POST(post({ file, instruction: "เปลี่ยนเรื่อง", profile: PROFILE, llm: EXTERNAL }));
    expect(v.status).toBe(200);
    const revised = ((await v.json()) as { file: { options: { speed: string }; wording: { subject: string } } }).file;
    expect(revised.wording.subject).toBe("เรื่องที่แก้แล้ว");
    expect(revised.options.speed).toBe("ด่วน"); // การแก้ไม่ทำให้ตัวเลือกของเอกสารหาย

    const x = await r.docx.POST(post({ file: revised, profile: PROFILE }));
    const zip = await JSZip.loadAsync(new Uint8Array(await x.arrayBuffer()));
    const xml = (await zip.file("word/document.xml")!.async("string")).replace(/\u200B/g, "");
    expect(xml).toContain("ผู้อำนวยการกองคลัง");
    expect(xml).toContain("เรื่องที่แก้แล้ว");
  });

  it("AI ล้ม/ตอบไม่ได้ → 502 หรือ 500 ที่ไม่เปิดเผยรายละเอียดภายใน", async () => {
    const r = await load({ NODE_ENV: "production" });
    // คิวว่าง = MockLLM โยน LLMError("ไม่มีคำตอบเหลือ")
    const res = await r.draft.POST(post({ type: "memo", request: "x", facts: {}, options: {}, llm: EXTERNAL }));
    expect([502, 500]).toContain(res.status);
    const body = JSON.stringify(await res.json());
    expect(body).not.toMatch(/sk-test|node_modules|at \w+ \(/);
  });
});

describe("/api/config — ลิงก์ซอร์สโค้ด (AGPL ข้อ 13)", () => {
  it("ส่ง sourceUrl เมื่อตั้งค่าเป็น https เท่านั้น", async () => {
    const get = async (env: Record<string, string>) => ((await (await load({ NODE_ENV: "production", ...env })).config.GET().json()) as { sourceUrl: string | null }).sourceUrl;
    expect(await get({})).toBeNull();
    expect(await get({ THDOCS_SOURCE_URL: "https://example.com/thdocs" })).toBe("https://example.com/thdocs");
    expect(await get({ THDOCS_SOURCE_URL: "http://example.com/x" })).toBeNull();
    expect(await get({ THDOCS_SOURCE_URL: "javascript:alert(1)" })).toBeNull();
  });
});
