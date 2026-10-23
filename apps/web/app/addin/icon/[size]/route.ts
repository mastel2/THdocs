import { drawPng } from "@thdocs/render-docx";

const SIZES = new Set([16, 32, 64, 80, 128]);
const BLUE: [number, number, number, number] = [29, 78, 216, 255];
const WHITE: [number, number, number, number] = [255, 255, 255, 255];

/** ไอคอน THdocs: พื้นน้ำเงินมุมมน + กระดาษสีขาวมีบรรทัด — วาดเป็นพิกเซลตามสัดส่วน ไม่ต้องมีไฟล์ภาพ */
function icon(n: number): Buffer {
  const r = n * 0.18;
  return drawPng(n, n, (x, y) => {
    const u = (x + 0.5) / n;
    const v = (y + 0.5) / n;
    const cx = Math.min(x + 0.5, n - x - 0.5);
    const cy = Math.min(y + 0.5, n - y - 0.5);
    if (cx < r && cy < r && (r - cx) ** 2 + (r - cy) ** 2 > r * r) return null; // มุมมน
    const onPage = u > 0.27 && u < 0.73 && v > 0.18 && v < 0.82 && !(u > 0.6 && v < 0.31 && u - 0.6 > v - 0.18);
    if (!onPage) return BLUE;
    const line = [0.42, 0.53, 0.64].some((l) => Math.abs(v - l) < Math.max(0.035, 0.6 / n)) && u > 0.35 && u < 0.65;
    return line ? BLUE : WHITE;
  });
}

export async function GET(_req: Request, { params }: { params: Promise<{ size: string }> }) {
  const n = Number((await params).size);
  if (!SIZES.has(n)) return new Response("not found", { status: 404 });
  return new Response(new Uint8Array(icon(n)), { headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=86400" } });
}
