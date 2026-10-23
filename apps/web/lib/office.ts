"use client";
/**
 * ตัวเชื่อม Word (Office.js) สำหรับหน้า /addin
 * office.js โหลดจาก CDN ของ Microsoft ตามข้อกำหนดของ Office — ประกาศ type เฉพาะส่วนที่ใช้ ไม่เพิ่มแพ็กเกจ
 */

interface WordContext {
  document: {
    body: { text: string; load(p: string): void; insertFileFromBase64(b64: string, loc: "Replace" | "Start" | "End"): unknown };
    getSelection(): { text: string; load(p: string): void; insertFileFromBase64(b64: string, loc: "Replace"): unknown };
    insertFileFromBase64?(b64: string, loc: "Replace", opts: Record<string, boolean>): unknown;
  };
  sync(): Promise<void>;
}

declare global {
  interface Window {
    Office?: {
      onReady(): Promise<{ host: string | null }>;
      context: { requirements: { isSetSupported(name: string, version: string): boolean } };
    };
    Word?: { run<T>(fn: (ctx: WordContext) => Promise<T>): Promise<T> };
  }
}

const OFFICE_JS = "https://appsforoffice.microsoft.com/lib/1/hosted/office.js";

/**
 * โหลด office.js หลังหน้าพร้อม — office.js ตั้ง history.pushState/replaceState เป็น null
 * เมื่อไม่ได้อยู่ใน Office ซึ่งทำให้ router ของ Next.js พัง จึงเก็บไว้แล้วคืนค่าหลังโหลด
 */
function loadOfficeJs(): Promise<void> {
  if (window.Office) return Promise.resolve();
  const keep = { push: history.pushState, replace: history.replaceState };
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = OFFICE_JS;
    s.onload = () => {
      history.pushState = keep.push;
      history.replaceState = keep.replace;
      resolve();
    };
    s.onerror = () => reject(new Error("โหลด office.js ไม่ได้"));
    document.head.appendChild(s);
  });
}

/** รอ Office พร้อม — คืน false ถ้าเปิดนอก Word (เช่น เปิดหน้า /addin ในเบราว์เซอร์ตรง ๆ) */
export async function officeReady(): Promise<boolean> {
  await loadOfficeJs();
  if (!window.Office) return false;
  const info = await window.Office.onReady();
  return info.host === "Word";
}

function word() {
  if (!window.Word) throw new Error("ต้องเปิดจากใน Microsoft Word");
  return window.Word;
}

export async function selectedText(): Promise<string> {
  return word().run(async (ctx) => {
    const sel = ctx.document.getSelection();
    sel.load("text");
    await ctx.sync();
    return sel.text.trim();
  });
}

export async function documentIsEmpty(): Promise<boolean> {
  return word().run(async (ctx) => {
    ctx.document.body.load("text");
    await ctx.sync();
    return ctx.document.body.text.trim() === "";
  });
}

/**
 * แทรกไฟล์ .docx ของ THdocs
 *   replace: แทนที่ทั้งเอกสาร — WordApi 1.5 คัดลอกขอบกระดาษ หัว/ท้ายกระดาษ และเลขหน้ามาด้วย
 *   cursor:  แทรกที่เคอร์เซอร์ — ได้เฉพาะเนื้อหา ใช้การตั้งค่าหน้าของเอกสารเดิม
 */
export async function insertDocx(base64: string, where: "replace" | "cursor"): Promise<"full" | "body-only"> {
  const full = window.Office?.context.requirements.isSetSupported("WordApi", "1.5") ?? false;
  return word().run(async (ctx) => {
    if (where === "cursor") {
      ctx.document.getSelection().insertFileFromBase64(base64, "Replace");
      await ctx.sync();
      return "body-only";
    }
    if (full && ctx.document.insertFileFromBase64) {
      ctx.document.insertFileFromBase64(base64, "Replace", { importTheme: false, importStyles: true, importParagraphSpacing: true, importPageColor: false, importDifferentOddEvenPages: true });
      await ctx.sync();
      return "full";
    }
    ctx.document.body.insertFileFromBase64(base64, "Replace");
    await ctx.sync();
    return "body-only";
  });
}

export async function blobToBase64(b: Blob): Promise<string> {
  const buf = new Uint8Array(await b.arrayBuffer());
  let s = "";
  for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return btoa(s);
}

interface OfficeFile {
  size: number;
  sliceCount: number;
  getSliceAsync(i: number, cb: (r: { status: string; value: { data: number[] }; error?: { message: string } }) => void): void;
  closeAsync(): void;
}

/** อ่านไฟล์ .docx ของเอกสารที่เปิดอยู่ใน Word (ไม่แก้เอกสาร) */
export function readOpenDocument(): Promise<Uint8Array> {
  const doc = (window.Office as unknown as { context: { document: { getFileAsync(type: string, opt: { sliceSize: number }, cb: (r: { status: string; value: OfficeFile; error?: { message: string } }) => void): void } } } | undefined)?.context.document;
  if (!doc) return Promise.reject(new Error("ต้องเปิดจากใน Microsoft Word"));
  return new Promise((resolve, reject) => {
    doc.getFileAsync("compressed", { sliceSize: 1 << 20 }, (r) => {
      if (r.status !== "succeeded") return reject(new Error(r.error?.message ?? "อ่านเอกสารไม่ได้"));
      const file = r.value;
      const parts: Uint8Array[] = [];
      const next = (i: number) => {
        file.getSliceAsync(i, (s) => {
          if (s.status !== "succeeded") {
            file.closeAsync();
            return reject(new Error(s.error?.message ?? "อ่านเอกสารไม่ได้"));
          }
          parts.push(Uint8Array.from(s.value.data));
          if (i + 1 < file.sliceCount) return next(i + 1);
          file.closeAsync();
          const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
          let at = 0;
          for (const p of parts) (out.set(p, at), (at += p.length));
          resolve(out);
        });
      };
      next(0);
    });
  });
}

/** แทนข้อความที่เลือกด้วยข้อความธรรมดา (จัดรูปแบบตัวอักษรของจุดนั้นตามเดิม) */
export async function replaceSelection(text: string): Promise<void> {
  return word().run(async (ctx) => {
    const sel = ctx.document.getSelection() as unknown as { insertText(t: string, loc: "Replace"): unknown };
    sel.insertText(text, "Replace");
    await ctx.sync();
  });
}
