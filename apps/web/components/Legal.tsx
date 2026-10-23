import type { ReactNode } from "react";

/** หน้านโยบาย/ข้อกำหนด — ช่อง [ระบุ: …] ผู้ให้บริการต้องกรอกก่อนเปิดสาธารณะ */
export function Legal({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  return (
    <main className="legal">
      <p><a href="/">← กลับไปที่ THdocs</a></p>
      <h1>{title}</h1>
      <p className="hint">ปรับปรุงล่าสุด {updated}</p>
      <p className="draft" role="note">
        <b>ฉบับร่าง</b> — ยังไม่ผ่านการตรวจโดยผู้เชี่ยวชาญด้านกฎหมาย และมีช่อง <b>[ระบุ: …]</b> ที่ผู้ให้บริการต้องกรอกก่อนเปิดใช้งานสาธารณะ
      </p>
      {children}
    </main>
  );
}
