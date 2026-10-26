import type { ReactNode } from "react";

/** หน้านโยบาย/ข้อกำหนด */
export function Legal({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  return (
    <main className="legal">
      <p><a href="/">← กลับไปที่ THdocs</a></p>
      <h1>{title}</h1>
      <p className="hint">ปรับปรุงล่าสุด {updated}</p>
      {children}
      <p className="hint">เอกสารนี้จัดทำโดยผู้ให้บริการเอง ไม่ใช่คำปรึกษากฎหมาย หากสงสัยเกี่ยวกับสิทธิของคุณ ติดต่อ art@keep-dark.com หรือปรึกษาผู้เชี่ยวชาญ</p>
    </main>
  );
}
