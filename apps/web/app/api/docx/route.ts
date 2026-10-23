import { assembleDraft, contextFromDraft } from "@thdocs/core";
import { renderDocx } from "@thdocs/render-docx";
import { z } from "zod";
import { findType } from "../../../lib/registry";
import { HttpError, draftFileFrom, handle, profileFrom, readJson } from "../../../lib/server";

const PNG_PREFIX = "data:image/png;base64,";

const Body = z.object({
  file: z.unknown(),
  profile: z.unknown().optional(),
  emblem: z.string().max(900_000).optional(),
});

export const POST = handle(async (req) => {
  const b = Body.parse(await readJson(req));
  const file = draftFileFrom(b.file);
  const def = findType(file.type)!;
  const ctx = contextFromDraft(file, profileFrom(b.profile));
  if (b.emblem && !b.emblem.startsWith(PNG_PREFIX)) throw new HttpError(400, "ตราต้องเป็นไฟล์ PNG");
  const emblemPng = b.emblem ? Buffer.from(b.emblem.slice(PNG_PREFIX.length), "base64") : undefined;
  let data: Buffer;
  try {
    data = await renderDocx(def.layout(assembleDraft(def, file, ctx), ctx), emblemPng ? { emblemPng } : {});
  } catch (e) {
    throw new HttpError(400, (e as Error).message);
  }
  const name = `${def.name}.docx`;
  return new Response(new Uint8Array(data), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="thdocs.docx"; filename*=UTF-8''${encodeURIComponent(name)}`,
    },
  });
});
