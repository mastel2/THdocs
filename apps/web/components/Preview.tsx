"use client";
import { useEffect, useRef, useState } from "react";

const PAGE_PX = (21 / 2.54) * 96;

/** แสดงหน้า A4 ย่อให้พอดีความกว้างคอลัมน์ */
export function Preview({ html }: { html: string | null }) {
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
    <div className="preview" ref={box}>
      {html ? (
        <div className="preview-zoom" style={{ zoom }} dangerouslySetInnerHTML={{ __html: html }} />
      ) : (
        <div className="preview-empty">
          <p>ตัวอย่างเอกสารจะแสดงที่นี่</p>
          <p className="hint">เลือกชนิดเอกสาร แล้วบอกสิ่งที่ต้องการ</p>
        </div>
      )}
    </div>
  );
}
