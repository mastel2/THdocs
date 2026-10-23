"use client";
/** สร้าง .docx ในเบราว์เซอร์ — ไม่ต้องมีเซิร์ฟเวอร์ ใช้ออฟไลน์ได้ และเนื้อหาเอกสารไม่ออกจากเครื่อง */
import { assembleDraft, contextFromDraft, type DraftFile, type OrgProfile } from "@thdocs/core";
import { renderDocx } from "@thdocs/render-docx";
import { findType } from "./registry";

const PNG_PREFIX = "data:image/png;base64,";
export const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export async function buildDocx(file: DraftFile, profile: OrgProfile, emblem?: string | null): Promise<Blob> {
  const def = findType(file.type);
  if (!def) throw new Error(`ไม่รู้จักชนิดเอกสาร '${file.type}'`);
  if (emblem && !emblem.startsWith(PNG_PREFIX)) throw new Error("ตราต้องเป็นไฟล์ PNG");
  const emblemPng = emblem ? Uint8Array.from(atob(emblem.slice(PNG_PREFIX.length)), (c) => c.charCodeAt(0)) : undefined;
  const ctx = contextFromDraft(file, profile);
  const bytes = await renderDocx(def.layout(assembleDraft(def, file, ctx), ctx), emblemPng ? { emblemPng } : {});
  return new Blob([new Uint8Array(bytes)], { type: DOCX_MIME });
}
