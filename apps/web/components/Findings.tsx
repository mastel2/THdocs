"use client";
import type { Finding } from "@thdocs/core";

export function Findings({ items }: { items: Finding[] }) {
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
