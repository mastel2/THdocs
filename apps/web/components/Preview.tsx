"use client";
import { useEffect, useRef, useState } from "react";

const PAGE_PX = (21 / 2.54) * 96;

/** แสดงหน้า A4 ย่อให้พอดีความกว้างคอลัมน์ — badge = ป้ายบอกว่าเป็นตัวอย่าง ไม่ใช่เอกสารของผู้ใช้ */
export function Preview({ html, badge }: { html: string | null; badge?: string }) {
  const box = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setZoom(Math.min(1, (e!.contentRect.width - 8) / PAGE_PX)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div className={badge ? "preview is-example" : "preview"} ref={box}>
      {badge && <div className="example-badge">{badge}</div>}
      {html ? (
        <div className="preview-zoom" style={{ zoom }} dangerouslySetInnerHTML={{ __html: html }} />
      ) : (
        <div className="preview-empty">
          <p>ตัวอย่างเอกสารจะแสดงที่นี่</p>
        </div>
      )}
    </div>
  );
}
