"use client";
import { useRef, useState } from "react";
import { REWRITE_MODES, type RewriteMode, type Secrecy } from "@thdocs/core";

const LABEL: Record<RewriteMode, string> = {
  formal: "ปรับเป็นภาษาราชการ",
  shorter: "ทำให้กระชับ",
  fix: "แก้คำผิด / ไวยากรณ์",
};

interface Props {
  needsSetup: boolean;
  onSetup(): void;
  /** ชื่อผู้ให้บริการที่ส่งข้อมูลออกนอกเครื่อง (ถ้ามี) ไว้เตือน */
  externalName?: string | undefined;
  rewrite(a: { text: string; mode: RewriteMode; secrecy?: Secrecy }, signal: AbortSignal): Promise<{ text: string; masked: string }>;
  /** ใน Word: อ่าน/แทนที่ข้อความที่เลือก */
  word?: { read(): Promise<string>; replace(text: string): Promise<void> };
}

/** ปรับข้อความที่ผู้ใช้เขียนเอง — วางข้อความ หรือดึงจากที่เลือกใน Word แล้วตรวจผลก่อนนำไปใช้ (ไม่แทนที่เองอัตโนมัติ) */
export function RewriteText({ needsSetup, onSetup, externalName, rewrite, word }: Props) {
  const [input, setInput] = useState("");
  const [mode, setMode] = useState<RewriteMode>("formal");
  const [secret, setSecret] = useState(false);
  const [output, setOutput] = useState("");
  const [masked, setMasked] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);

  async function guarded<T>(fn: () => Promise<T>): Promise<T | undefined> {
    setError(null);
    setNotice(null);
    try {
      return await fn();
    } catch (e) {
      if ((e as Error).name !== "AbortError") setError((e as Error).message);
      return undefined;
    }
  }

  async function pull() {
    const t = await guarded(() => word!.read());
    if (t) setInput(t);
    else if (t === "") setError("ยังไม่ได้เลือกข้อความใน Word");
  }

  async function run() {
    if (needsSetup) return onSetup();
    abort.current = new AbortController();
    setBusy(true);
    const r = await guarded(() => rewrite({ text: input, mode, ...(secret ? { secrecy: "ลับ" as Secrecy } : {}) }, abort.current!.signal));
    setBusy(false);
    if (r) {
      setOutput(r.text);
      setMasked(r.masked);
    }
  }

  async function apply() {
    await guarded(async () => {
      await word!.replace(output);
      setNotice("แทนที่ข้อความที่เลือกใน Word แล้ว (กด Ctrl+Z ใน Word เพื่อย้อนกลับได้)");
    });
  }

  return (
    <div className="card form">
      <h2>ปรับข้อความที่เขียนเอง</h2>
      <p className="hint">วางข้อความ{word ? "หรือเลือกใน Word" : ""} แล้วให้ AI ปรับ — ผลลัพธ์ต้องตรวจก่อนใช้ ระบบไม่แทนที่ให้เองจนกว่าจะกดยืนยัน</p>
      <label>
        ข้อความเดิม
        <textarea rows={6} value={input} onChange={(e) => setInput(e.target.value)} placeholder="วางข้อความที่ต้องการปรับ" />
      </label>
      {word && <button type="button" className="ghost small" disabled={busy} onClick={pull}>ใช้ข้อความที่เลือกใน Word</button>}
      <label>
        ให้ AI
        <select value={mode} onChange={(e) => setMode(e.target.value as RewriteMode)}>
          {(Object.keys(REWRITE_MODES) as RewriteMode[]).map((m) => <option key={m} value={m}>{LABEL[m]}</option>)}
        </select>
      </label>
      <label className="check">
        <input type="checkbox" checked={secret} onChange={(e) => setSecret(e.target.checked)} /> ข้อความนี้เป็นความลับ (ไม่ส่งให้ AI ภายนอก)
      </label>
      {externalName && !secret && <p className="hint">ข้อความจะถูกส่งให้ {externalName} — ข้อมูลส่วนบุคคล (เลขบัตร โทรศัพท์ อีเมล) ถูกปิดบังก่อนส่ง</p>}
      <div className="actions">
        <button className="primary" disabled={!input.trim() || busy} onClick={run}>ปรับข้อความ</button>
        {busy && <button className="ghost" onClick={() => abort.current?.abort()}>ยกเลิก</button>}
      </div>
      {busy && <p className="notice busy" role="status"><span className="spinner" aria-hidden /> กำลังปรับ…</p>}
      {error && <p className="notice err" role="alert">{error}</p>}
      {notice && <p className="notice ok" role="status">{notice}</p>}
      {output && (
        <>
          {masked && <p className="notice ok">ปิดบังข้อมูลส่วนบุคคลก่อนส่ง: {masked} — ใส่ค่าจริงกลับในผลลัพธ์แล้ว</p>}
          <label>
            ผลลัพธ์ (แก้ได้)
            <textarea rows={6} value={output} onChange={(e) => setOutput(e.target.value)} />
          </label>
          <div className="actions">
            {word && <button className="primary" onClick={apply}>แทนที่ข้อความที่เลือกใน Word</button>}
            <button className="ghost" onClick={() => void navigator.clipboard?.writeText(output).then(() => setNotice("คัดลอกแล้ว"))}>คัดลอก</button>
          </div>
        </>
      )}
    </div>
  );
}
