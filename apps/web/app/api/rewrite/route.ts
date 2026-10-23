import { REWRITE_MODES, maskSummary, rewriteText, type PrivacyAudit, type RewriteMode } from "@thdocs/core";
import { z } from "zod";
import { LLMChoiceSchema, handle, llmFrom, rateLimit, readJson } from "../../../lib/server";

const Body = z.object({
  text: z.string().min(1).max(20000),
  mode: z.enum(Object.keys(REWRITE_MODES) as [RewriteMode, ...RewriteMode[]]),
  secrecy: z.enum(["ลับที่สุด", "ลับมาก", "ลับ"]).optional(),
  llm: LLMChoiceSchema,
});

export const POST = handle(async (req) => {
  rateLimit(req);
  const b = Body.parse(await readJson(req));
  const audit: PrivacyAudit = { masked: [] };
  const text = await rewriteText(llmFrom(b.llm), b.text, b.mode, b.secrecy, audit);
  return Response.json({ text, masked: maskSummary(audit.masked) });
});
