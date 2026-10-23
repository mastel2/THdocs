"use client";
import { useState } from "react";
import { summarize, type Finding, type TemplatePack } from "@thdocs/core";
import { inspectDocx, inspectOptionsFor } from "@thdocs/render-docx/inspect";
import { Findings } from "./Findings";

/**
 * ตรวจไฟล์ Word ที่เขียนเอง — อ่านและตรวจในเบราว์เซอร์ทั้งหมด ไฟล์ไม่ถูกอัปโหลดไปที่ไหน
 * ใน Word add-in อ่านเอกสารที่เปิดอยู่ได้โดยตรง
 */
export function CheckDocx({ packs, readOpen }: { packs: TemplatePack[]; readOpen?: () => Promise<Uint8Array> }) {
  const [packId, setPackId] = useState(packs[0]!.id);
  const [name, setName] = useState<string | null>(null);
  const [findings, setFindings] = useState<Finding[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const pack = packs.find((p) => p.id === packId)!;

  async function run(label: string, read: () => Promise<Uint8Array>) {
    setBusy(true);
    setError(null);
    setFindings(null);
    setName(label);
    try {
      const r = await inspectDocx(await read(), inspectOptionsFor(pack));
      setFindings(r.findings);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const s = findings ? summarize(findings) : null;
  return (
    <div className="card form">
      <h2>ตรวจไฟล์ Word ที่เขียนเอง</h2>
      <p className="hint">ตรวจขนาดกระดาษ ขอบ ฟอนต์ ตราครุฑ เลขไทย และข้อความ ตามชุดแม่แบบที่เลือก — ไฟล์ถูกอ่านในเครื่องของคุณ ไม่ถูกส่งไปที่ใด</p>
      <label>
        ตรวจตามชุดแม่แบบ
        <select value={packId} onChange={(e) => { setPackId(e.target.value); setFindings(null); }}>
          {packs.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </label>
      <div className="actions">
        <label className="file primary">
          เลือกไฟล์ .docx
          <input
            type="file"
            accept=".docx,.dotx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) void run(f.name, async () => new Uint8Array(await f.arrayBuffer()));
            }}
          />
        </label>
        {readOpen && <button className="ghost" disabled={busy} onClick={() => run("เอกสารที่เปิดอยู่", readOpen)}>ตรวจเอกสารที่เปิดอยู่</button>}
      </div>
      {busy && <p className="notice busy" role="status"><span className="spinner" aria-hidden /> กำลังตรวจ…</p>}
      {error && <p className="notice err" role="alert">{error}</p>}
      {s && (
        <div role="status">
          <p><b>{name}</b> — ผิด {s.errors} · ควรแก้ {s.warnings} · แนะนำ {s.infos}</p>
          <Findings items={s.findings} />
        </div>
      )}
    </div>
  );
}
