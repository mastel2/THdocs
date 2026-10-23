"use client";
import {
  assembleDraft,
  check,
  contextFromDraft,
  exampleDraft,
  summarize,
  toLLMSchema,
  type DraftFile,
  type Facts,
  type Finding,
  type OrgProfile,
  type Secrecy,
  type Speed,
} from "@thdocs/core";
import { PAGE_CSS, renderHtml } from "@thdocs/render-html";
import { useEffect, useMemo, useRef, useState } from "react";
import { api, download, load, save } from "../lib/client";
import { PACKS, TYPES, findType, type LLMChoice, type ProviderInfo } from "../lib/registry";
import { Preview } from "./Preview";
import { SchemaForm } from "./SchemaForm";
import { LLMSettings, ProfileSettings } from "./Settings";

type Step = "request" | "facts" | "edit";
type Panel = "profile" | "llm" | null;

const EMPTY_PROFILE: OrgProfile = { orgName: "", unit: "", address: [] };
/** เครื่องที่ไม่มี TH Sarabun ใช้ Sarabun (Google Fonts) — render-html ปรับขนาดตาให้เท่ากันด้วย font-size-adjust */
const PREVIEW_FONTS = '"TH Sarabun New", var(--font-sarabun), sans-serif';
const K = { profile: "thdocs.profile", emblem: "thdocs.emblem", llm: "thdocs.llm", remember: "thdocs.rememberKey", draft: "thdocs.draft" };

interface Saved {
  file: DraftFile;
  request: string;
}

export function Studio() {
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [profile, setProfile] = useState<OrgProfile>(EMPTY_PROFILE);
  const [emblem, setEmblem] = useState<string | null>(null);
  const [llm, setLlm] = useState<LLMChoice>({ provider: "anthropic" });
  const [remember, setRemember] = useState(false);
  const [panel, setPanel] = useState<Panel>(null);

  const [step, setStep] = useState<Step>("request");
  const [typeId, setTypeId] = useState(TYPES[0]!.id);
  const [request, setRequest] = useState("");
  const [speed, setSpeed] = useState<Speed | "">("");
  const [secrecy, setSecrecy] = useState<Secrecy | "">("");
  const [facts, setFacts] = useState<Facts>({});
  const [missing, setMissing] = useState<string[]>([]);
  const [file, setFile] = useState<DraftFile | null>(null);
  const [instruction, setInstruction] = useState("");

  const [busy, setBusy] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);

  // โหลดค่าที่จำไว้ (หลัง mount เพื่อไม่ให้ HTML ฝั่งเซิร์ฟเวอร์ต่างจากฝั่งเบราว์เซอร์)
  useEffect(() => {
    setProfile(load(K.profile, EMPTY_PROFILE));
    setEmblem(load<string | null>(K.emblem, null));
    setLlm(load(K.llm, { provider: "anthropic" }));
    setRemember(load(K.remember, false));
    const d = load<Saved | null>(K.draft, null);
    if (d && findType(d.file.type)) {
      setFile(d.file);
      setTypeId(d.file.type);
      setRequest(d.request);
      setFacts(d.file.facts);
      setStep("edit");
    }
    fetch("/api/config").then((r) => r.json()).then((c: { providers: ProviderInfo[] }) => setProviders(c.providers)).catch(() => {});
  }, []);

  useEffect(() => save(K.profile, profile), [profile]);
  useEffect(() => save(K.emblem, emblem ?? undefined), [emblem]);
  useEffect(() => {
    save(K.remember, remember);
    save(K.llm, remember ? llm : { ...llm, apiKey: undefined });
  }, [llm, remember]);
  useEffect(() => save(K.draft, file ? { file, request } : undefined), [file, request]);

  useEffect(() => {
    if (!busy) return;
    setElapsed(0);
    const t = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [busy]);

  const def = findType(typeId)!;
  const provider = providers.find((p) => p.id === llm.provider);
  const options = { ...(speed ? { speed } : {}), ...(secrecy ? { secrecy } : {}) };

  // ประกอบเอกสาร ตรวจ และสร้างพรีวิวในเบราว์เซอร์ทันทีทุกครั้งที่แก้
  const view = useMemo(() => {
    if (!file) return null;
    const d = findType(file.type)!;
    try {
      const ctx = contextFromDraft(file, profile);
      const doc = assembleDraft(d, file, ctx);
      return {
        html: renderHtml(d.layout(doc, ctx), { fallbackFonts: PREVIEW_FONTS, ...(emblem ? { emblemSrc: emblem } : {}) }),
        result: summarize(check(d, doc, ctx)),
        problem: null,
      };
    } catch (e) {
      return { html: null, result: null, problem: (e as Error).message };
    }
  }, [file, profile, emblem]);

  // ยังไม่มีร่าง: แสดงตัวอย่างของชนิดที่เลือก ให้เห็นภาพก่อนเริ่ม (ใช้ข้อมูลหน่วยงานของผู้ใช้ถ้ากรอกแล้ว)
  const exampleHtml = useMemo(() => {
    const ex = exampleDraft(def);
    if (!ex) return null;
    const ctx = contextFromDraft(ex, profile.orgName ? profile : (PACKS.find((p) => p.types.includes(def))?.demoProfile ?? profile));
    return renderHtml(def.layout(assembleDraft(def, ex, ctx), ctx), { fallbackFonts: PREVIEW_FONTS, ...(emblem ? { emblemSrc: emblem } : {}) });
  }, [def, profile, emblem]);

  function startFromExample() {
    const ex = exampleDraft(def);
    if (!ex) return;
    const { docNo: _demoNo, ...facts } = ex.facts; // เลขที่ของตัวอย่างเป็นของสมมติ
    setFile({ ...ex, facts });
    setFacts(facts);
    setRequest(def.example!.request);
    setStep("edit");
  }

  const wordingSchema = useMemo(() => (file ? toLLMSchema(findType(file.type)!.wordingSchema) : null), [file?.type]);

  async function run<T>(label: string, fn: (signal: AbortSignal) => Promise<T>): Promise<T | undefined> {
    setError(null);
    setBusy(label);
    abort.current = new AbortController();
    try {
      return await fn(abort.current.signal);
    } catch (e) {
      if ((e as Error).name !== "AbortError") setError((e as Error).message);
      return undefined;
    } finally {
      setBusy(null);
    }
  }

  const needsSetup = !provider || (provider.needsKey && !llm.apiKey) || (provider.needsModel && !llm.model);

  async function analyze() {
    if (needsSetup) return setPanel("llm");
    const r = await run("กำลังอ่านคำขอ", (signal) =>
      api<{ facts: Facts; missing: string[] }>("/api/facts", { type: typeId, request, profile, options, known: {}, llm }, signal),
    );
    if (!r) return;
    setFacts(r.facts);
    setMissing(r.missing);
    setStep("facts");
  }

  async function makeDraft() {
    const f = await run(`กำลังร่าง${def.name}`, (signal) =>
      api<DraftFile>("/api/draft", { type: typeId, request, facts, profile, options, llm }, signal),
    );
    if (!f) return;
    setFile(f);
    setStep("edit");
  }

  async function reviseDraft() {
    if (!file || !instruction.trim()) return;
    const f = await run("กำลังแก้ไข", (signal) => api<DraftFile>("/api/revise", { file, instruction, profile, llm }, signal));
    if (!f) return;
    setFile(f);
    setInstruction("");
  }

  async function getDocx() {
    if (!file) return;
    const blob = await run("กำลังสร้างไฟล์", (signal) =>
      api<Blob>("/api/docx", { file, profile, ...(emblem ? { emblem } : {}) }, signal),
    );
    if (blob) download(blob, `${findType(file.type)!.name}.docx`);
  }

  function saveDraft() {
    if (!file) return;
    download(new Blob([JSON.stringify({ ...file, request }, null, 2)], { type: "application/json" }), `${findType(file.type)!.name}.thdocs.json`);
  }

  function openDraft(f: File | undefined) {
    if (!f) return;
    f.text().then((t) => {
      try {
        const j = JSON.parse(t) as DraftFile & { request?: string };
        if (j.thdocs !== 1 || !findType(j.type)) throw new Error();
        const { request: req, ...rest } = j;
        setFile(rest);
        setTypeId(rest.type);
        setFacts(rest.facts);
        setRequest(req ?? "");
        setStep("edit");
      } catch {
        setError("ไฟล์นี้ไม่ใช่ร่างของ THdocs");
      }
    });
  }

  function reset() {
    setFile(null);
    setFacts({});
    setMissing([]);
    setInstruction("");
    setStep("request");
  }

  const confidentialBlocked = !!secrecy && provider?.external;

  return (
    <div className="app">
      <style>{PAGE_CSS}</style>
      <header className="topbar">
        <div className="brand">THdocs <span>ร่างหนังสือราชการด้วย AI</span></div>
        <nav>
          <button className={panel === "profile" ? "tab on" : "tab"} onClick={() => setPanel(panel === "profile" ? null : "profile")}>ข้อมูลหน่วยงาน</button>
          <button className={panel === "llm" ? "tab on" : "tab"} onClick={() => setPanel(panel === "llm" ? null : "llm")}>
            AI: {provider?.name ?? "…"}
          </button>
        </nav>
      </header>

      <main className="layout">
        <section className="side">
          {panel === "profile" && (
            <div className="card">
              <h2>ข้อมูลหน่วยงาน</h2>
              <ProfileSettings profile={profile} onChange={setProfile} emblem={emblem} onEmblem={setEmblem} />
              <button className="primary" onClick={() => setPanel(null)}>เสร็จ</button>
            </div>
          )}
          {panel === "llm" && (
            <div className="card">
              <h2>ตั้งค่า AI</h2>
              <LLMSettings providers={providers} choice={llm} onChange={setLlm} remember={remember} onRemember={setRemember} />
              <button className="primary" onClick={() => setPanel(null)}>เสร็จ</button>
            </div>
          )}

          {!panel && (
            <>
              <ol className="steps" aria-label="ขั้นตอน">
                <li className={step === "request" ? "on" : ""}>คำขอ</li>
                <li className={step === "facts" ? "on" : ""}>ข้อมูล</li>
                <li className={step === "edit" ? "on" : ""}>ตรวจและแก้</li>
              </ol>

              {error && <p className="notice err" role="alert">{error}</p>}
              {busy && (
                <div className="notice busy" role="status">
                  <span className="spinner" aria-hidden /> {busy}… {elapsed} วินาที
                  {!provider?.external && elapsed > 20 && <span className="hint"> (โมเดลในเครื่องอาจใช้เวลาหลายนาที)</span>}
                  <button className="ghost small" onClick={() => abort.current?.abort()}>ยกเลิก</button>
                </div>
              )}

              {step === "request" && (
                <div className="card form">
                  <label>
                    ชนิดเอกสาร
                    <select value={typeId} onChange={(e) => setTypeId(e.target.value)}>
                      {TYPES.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                    <span className="hint">{def.description}</span>
                  </label>
                  <label>
                    ต้องการเอกสารเรื่องอะไร
                    <textarea
                      rows={5}
                      value={request}
                      onChange={(e) => setRequest(e.target.value)}
                      placeholder="บอกเรื่องที่ต้องการ: ถึงใคร ต้องการอะไร วัน เวลา สถานที่ จำนวน งบประมาณ"
                    />
                  </label>
                  {def.example && (
                    <div className="example-req">
                      <span className="hint">ตัวอย่างคำขอสำหรับ{def.name}</span>
                      <p>{def.example.request}</p>
                      <div className="actions">
                        <button type="button" className="ghost small" onClick={() => setRequest(def.example!.request)}>ใช้ข้อความนี้</button>
                        <button type="button" className="ghost small" onClick={startFromExample}>เปิดตัวอย่างนี้แก้ต่อ (ไม่ต้องใช้ AI)</button>
                      </div>
                    </div>
                  )}
                  <div className="row">
                    <label>
                      ชั้นความเร็ว
                      <select value={speed} onChange={(e) => setSpeed(e.target.value as Speed | "")}>
                        <option value="">ไม่มี</option><option>ด่วน</option><option>ด่วนมาก</option><option>ด่วนที่สุด</option>
                      </select>
                    </label>
                    <label>
                      ชั้นความลับ
                      <select value={secrecy} onChange={(e) => setSecrecy(e.target.value as Secrecy | "")}>
                        <option value="">ไม่มี</option><option>ลับ</option><option>ลับมาก</option><option>ลับที่สุด</option>
                      </select>
                    </label>
                  </div>
                  {confidentialBlocked && (
                    <p className="notice err">เอกสารชั้นความลับส่งให้ {provider?.name} ไม่ได้ — เปลี่ยนเป็น AI ในเครื่อง (ตั้งค่า AI)</p>
                  )}
                  {!profile.orgName && (
                    <p className="notice warn">
                      ยังไม่ได้กรอกข้อมูลหน่วยงาน — เอกสารจะมีช่อง [ระบุ] แทน <button className="link" onClick={() => setPanel("profile")}>กรอกตอนนี้</button>
                    </p>
                  )}
                  <div className="actions">
                    <button className="primary" disabled={!request.trim() || !!busy || confidentialBlocked} onClick={analyze}>ถัดไป</button>
                    <label className="file ghost">
                      เปิดร่างที่บันทึกไว้
                      <input type="file" accept=".json,application/json" onChange={(e) => openDraft(e.target.files?.[0])} />
                    </label>
                  </div>
                </div>
              )}

              {step === "facts" && (
                <div className="card form">
                  <p className="hint">ตรวจข้อมูลที่ระบบอ่านได้จากคำขอ เติมช่องที่ขาด — ช่องที่เว้นว่างจะเป็น [ระบุ] ในเอกสาร ระบบไม่ให้ AI เดา</p>
                  {def.facts.map((f) => (
                    <label key={f.key} className={missing.includes(f.key) ? "missing" : ""}>
                      <span>{f.question}{f.required && <b className="req" aria-label="จำเป็น"> *</b>}</span>
                      <input value={facts[f.key] ?? ""} placeholder={f.example ?? ""} onChange={(e) => setFacts({ ...facts, [f.key]: e.target.value || null })} />
                    </label>
                  ))}
                  <div className="actions">
                    <button className="ghost" onClick={() => setStep("request")}>ย้อนกลับ</button>
                    <button className="primary" disabled={!!busy} onClick={makeDraft}>ร่างเอกสาร</button>
                  </div>
                </div>
              )}

              {step === "edit" && file && (
                <>
                  {!profile.orgName && (
                    <p className="notice warn">
                      ช่อง [ระบุ] ที่ไฮไลต์ส่วนใหญ่จะหายเมื่อกรอกข้อมูลหน่วยงานและผู้ลงนาม{" "}
                      <button className="link" onClick={() => setPanel("profile")}>กรอกตอนนี้</button>
                    </p>
                  )}
                  <div className="card">
                    <h2>ผลตรวจตามระเบียบ</h2>
                    {view?.problem && <p className="notice err">{view.problem}</p>}
                    {view?.result && <Findings items={view.result.findings} />}
                  </div>
                  <div className="card form">
                    <h2>สั่ง AI แก้</h2>
                    <textarea rows={2} value={instruction} onChange={(e) => setInstruction(e.target.value)} placeholder="เช่น ทำให้ภาคเหตุกระชับขึ้น และเพิ่มว่าจะใช้งบประมาณจากแผนปี 2570" />
                    <div className="actions">
                      <button className="primary" disabled={!instruction.trim() || !!busy} onClick={reviseDraft}>แก้ไข</button>
                    </div>
                  </div>
                  <details className="card">
                    <summary><h2>แก้ถ้อยคำเอง</h2></summary>
                    {wordingSchema && (
                      <SchemaForm schema={wordingSchema} value={file.wording} onChange={(wording) => setFile({ ...file, wording })} />
                    )}
                  </details>
                  <details className="card">
                    <summary><h2>ข้อมูลประกอบ (เลขที่ วันที่ ผู้ลงนาม)</h2></summary>
                    <div className="form">
                      {findType(file.type)!.facts.map((f) => (
                        <label key={f.key}>
                          {f.question}
                          <input value={file.facts[f.key] ?? ""} onChange={(e) => setFile({ ...file, facts: { ...file.facts, [f.key]: e.target.value || null } })} />
                        </label>
                      ))}
                    </div>
                  </details>
                </>
              )}
            </>
          )}
        </section>

        <section className="main">
          {file && (
            <div className="toolbar">
              <button className="primary" disabled={!!busy || !view?.html} onClick={getDocx}>ดาวน์โหลด .docx</button>
              <button className="ghost" disabled={!view?.html} onClick={() => window.print()}>พิมพ์ / PDF</button>
              <button className="ghost" onClick={saveDraft}>บันทึกร่าง</button>
              <button className="ghost" onClick={reset}>เริ่มใหม่</button>
            </div>
          )}
          {file ? (
            <Preview html={view?.html ?? null} />
          ) : (
            <Preview html={exampleHtml} badge={`ตัวอย่าง${def.name} — เอกสารของคุณจะจัดรูปแบบแบบนี้`} />
          )}
          {file && <p className="hint center">ตัวอย่างบนจอ — การแบ่งหน้าจริงดูจากไฟล์ .docx · ระบบสร้าง <b>ร่าง</b> ผู้มีอำนาจต้องตรวจก่อนลงนาม</p>}
        </section>
      </main>
    </div>
  );
}

function Findings({ items }: { items: Finding[] }) {
  if (!items.length) return <p className="notice ok">ไม่พบข้อผิดพลาดตามกฎที่ตรวจ</p>;
  const label = { error: "ผิด", warning: "ควรแก้", info: "แนะนำ" } as const;
  return (
    <ul className="findings">
      {items.map((f, i) => (
        <li key={i} className={f.level}>
          <span className="badge">{label[f.level]}</span>
          <span>{f.message}{f.ref && <span className="hint"> — {f.ref}</span>}</span>
        </li>
      ))}
    </ul>
  );
}
