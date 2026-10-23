import { drawPng } from "@thdocs/render-docx";

const BLUE: [number, number, number, number] = [29, 78, 216, 255];
const WHITE: [number, number, number, number] = [255, 255, 255, 255];

/**
 * ไอคอน THdocs: พื้นน้ำเงิน + กระดาษสีขาวมีบรรทัด — วาดเป็นพิกเซลตามสัดส่วน ไม่ต้องมีไฟล์ภาพ
 *   rounded  = มุมมน (ไอคอนทั่วไป)
 *   maskable = เต็มพื้นไม่มีมุมโปร่ง และย่อตัวกระดาษเข้าในโซนปลอดภัย 80% (ระบบจะตัดเป็นวงกลม/สี่เหลี่ยมมนเอง)
 */
export function appIcon(n: number, mode: "rounded" | "maskable" = "rounded"): Buffer {
  const r = mode === "rounded" ? n * 0.18 : 0;
  const k = mode === "maskable" ? 0.78 : 1; // ย่อตัวกระดาษเข้าหาจุดกึ่งกลาง
  return drawPng(n, n, (x, y) => {
    const cx = Math.min(x + 0.5, n - x - 0.5);
    const cy = Math.min(y + 0.5, n - y - 0.5);
    if (r > 0 && cx < r && cy < r && (r - cx) ** 2 + (r - cy) ** 2 > r * r) return null; // มุมมน
    const u = 0.5 + ((x + 0.5) / n - 0.5) / k;
    const v = 0.5 + ((y + 0.5) / n - 0.5) / k;
    const onPage = u > 0.27 && u < 0.73 && v > 0.18 && v < 0.82 && !(u > 0.6 && v < 0.31 && u - 0.6 > v - 0.18);
    if (!onPage) return BLUE;
    const line = [0.42, 0.53, 0.64].some((l) => Math.abs(v - l) < Math.max(0.035, 0.6 / (n * k))) && u > 0.35 && u < 0.65;
    return line ? BLUE : WHITE;
  });
}
