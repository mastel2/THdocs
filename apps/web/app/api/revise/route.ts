import { contextFromDraft, revise } from "@thdocs/core";
import { z } from "zod";
import { findType } from "../../../lib/registry";
import { LLMChoiceSchema, draftFileFrom, handle, llmFrom, profileFrom, rateLimit, readJson } from "../../../lib/server";

const Body = z.object({
  file: z.unknown(),
  instruction: z.string().min(1).max(4000),
  profile: z.unknown().optional(),
  llm: LLMChoiceSchema,
});

export const POST = handle(async (req) => {
  rateLimit(req);
  const b = Body.parse(await readJson(req));
  const file = draftFileFrom(b.file);
  // ชั้นความลับมาจากไฟล์ร่าง — การตรวจ AI ภายนอกทำใน revise()
  const ctx = contextFromDraft(file, profileFrom(b.profile));
  return Response.json(await revise(llmFrom(b.llm), findType(file.type)!, file, b.instruction, ctx));
});
