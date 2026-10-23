"use client";

export async function api<T>(path: string, body: unknown, signal?: AbortSignal): Promise<T> {
  const r = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    ...(signal ? { signal } : {}),
  });
  if (!r.ok) {
    const detail = await r.json().then((j: { detail?: string }) => j.detail).catch(() => undefined);
    throw new Error(detail ?? `เกิดข้อผิดพลาด (${r.status})`);
  }
  return r.headers.get("content-type")?.includes("json") ? ((await r.json()) as T) : ((await r.blob()) as T);
}

/** localStorage อาจใช้ไม่ได้ (private mode / ถูกปิด) — หน้าเว็บต้องทำงานได้โดยไม่มีมัน */
export function load<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function save(key: string, value: unknown) {
  try {
    if (value === undefined) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ไม่จำก็ได้ */
  }
}

export function download(data: Blob, name: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(data);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
}
