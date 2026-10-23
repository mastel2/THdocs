"use client";
import { useEffect, useRef, useState } from "react";
import { load, save } from "../lib/client";

const PAGE_W = (21 / 2.54) * 96;
const PAGE_H = (29.7 / 2.54) * 96;

type Fit = "width" | "page";

interface Props {
  html: string | null;
  /** ป้ายบอกว่าเป็นตัวอย่าง ไม่ใช่เอกสารของผู้ใช้ */
  badge?: string;
  /** เปิด/ปิดเส้นระยะขอบ — ผู้เรียกสร้าง html ใหม่ตามค่านี้ */
  guides?: boolean;
  onGuides?: (v: boolean) => void;
}

/**
 * แสดงหน้า A4 ย่อตามพื้นที่: พอดีความกว้าง (อ่านง่าย เลื่อนดูทั้งเอกสาร) หรือทั้งหน้า (เห็นผังทั้งหน้าในจอเดียว)
 * กรอบพรีวิวเลื่อนในตัวเอง — เอกสารยาวกี่หน้าก็ไม่ถูกตัด
 */
export function Preview({ html, badge, guides, onGuides }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: PAGE_W, h: PAGE_H });
  const [fit, setFit] = useState<Fit>("width");
  /** ความสูงจริงของเอกสาร (px ที่ซูม 100%) — เอกสารหลายหน้าสูงกว่า A4 หน้าเดียว */
  const [natural, setNatural] = useState({ w: PAGE_W, h: PAGE_H });
  const inner = useRef<HTMLDivElement>(null);

  useEffect(() => setFit(load<Fit>("thdocs.previewFit", "width")), []);
  useEffect(() => save("thdocs.previewFit", fit), [fit]);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setSize({ w: e!.contentRect.width, h: e!.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const byWidth = (size.w - 24) / natural.w;
  // "ทั้งเอกสาร": ย่อให้เห็นทั้งเอกสารในกรอบเดียว (วัดความสูงจริง ไม่ใช่แค่ A4 หน้าเดียว)
  // ใช้ได้เมื่อกรอบมีความสูงแน่นอน (จอกว้าง) — จอแคบกรอบสูงตามเนื้อหา จึงพอดีความกว้างเสมอ
  const byPage = size.h > 200 ? Math.min(byWidth, (size.h - 40) / natural.h) : byWidth;
  const zoom = Math.max(0.2, Math.min(1, fit === "page" ? byPage : byWidth));

  useEffect(() => {
    const page = inner.current?.querySelector<HTMLElement>(".thd-page");
    if (!page) return;
    const r = page.getBoundingClientRect();
    setNatural({ w: PAGE_W, h: Math.max(PAGE_H, r.height / zoom) });
  }, [html, zoom]);

  return (
    <div className="preview-wrap">
      {html && (
        <div className="preview-controls" role="toolbar" aria-label="มุมมองพรีวิว">
          <div className="seg">
            <button type="button" className={fit === "width" ? "on" : ""} aria-pressed={fit === "width"} onClick={() => setFit("width")}>พอดีความกว้าง</button>
            <button type="button" className={fit === "page" ? "on" : ""} aria-pressed={fit === "page"} onClick={() => setFit("page")}>ทั้งเอกสาร</button>
          </div>
          {onGuides && (
            <label className="check small">
              <input type="checkbox" checked={!!guides} onChange={(e) => onGuides(e.target.checked)} /> แสดงระยะขอบ
            </label>
          )}
          <span className="hint">{Math.round(zoom * 100)}%</span>
        </div>
      )}
      <div className={badge ? "preview is-example" : "preview"} ref={box}>
        {badge && <div className="example-badge">{badge}</div>}
        {html ? (
          <div className="preview-zoom" ref={inner} style={{ zoom }} dangerouslySetInnerHTML={{ __html: html }} />
        ) : (
          <div className="preview-empty">
            <p>ตัวอย่างเอกสารจะแสดงที่นี่</p>
          </div>
        )}
      </div>
    </div>
  );
}
