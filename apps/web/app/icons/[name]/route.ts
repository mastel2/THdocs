import { appIcon } from "../../../lib/icon";

/** ไอคอนแอป: 192/512 (ทั่วไป), maskable-192/512 (เต็มพื้น), apple-180 (iOS) */
const ICONS: Record<string, [number, "rounded" | "maskable"]> = {
  "192": [192, "rounded"],
  "512": [512, "rounded"],
  "maskable-192": [192, "maskable"],
  "maskable-512": [512, "maskable"],
  "apple-180": [180, "maskable"], // iOS มุมมนให้เอง
};

export async function GET(_req: Request, { params }: { params: Promise<{ name: string }> }) {
  const spec = ICONS[(await params).name];
  if (!spec) return new Response("not found", { status: 404 });
  return new Response(new Uint8Array(appIcon(...spec)), { headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=86400" } });
}
