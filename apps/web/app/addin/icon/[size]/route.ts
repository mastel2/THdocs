import { appIcon } from "../../../../lib/icon";

const SIZES = new Set([16, 32, 64, 80, 128]);

export async function GET(_req: Request, { params }: { params: Promise<{ size: string }> }) {
  const n = Number((await params).size);
  if (!SIZES.has(n)) return new Response("not found", { status: 404 });
  return new Response(new Uint8Array(appIcon(n)), { headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=86400" } });
}
