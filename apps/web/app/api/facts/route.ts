import { extractFacts, maskSummary, type Context, type PrivacyAudit } from "@thdocs/core";
import { z } from "zod";
import { findType } from "../../../lib/registry";
import { FactsSchema, HttpError, LLMChoiceSchema, OptionsSchema, handle, llmFrom, profileFrom, rateLimit, readJson } from "../../../lib/server";

const Body = z.object({
  type: z.string(),
  request: z.string().min(1).max(8000),
  profile: z.unknown().optional(),
  options: OptionsSchema,
  known: FactsSchema.default({}),
  llm: LLMChoiceSchema,
});

export const POST = handle(async (req) => {
  rateLimit(req);
  const b = Body.parse(await readJson(req));
  const def = findType(b.type);
  if (!def) throw new HttpError(400, `ไม่รู้จักชนิดเอกสาร '${b.type}'`);
  const { date, ...rest } = b.options;
  const ctx: Context = { profile: profileFrom(b.profile), options: { ...rest, ...(date ? { date: new Date(date) } : {}) } };
  const audit: PrivacyAudit = { masked: [] };
  const { facts, missing } = await extractFacts(llmFrom(b.llm), def, b.request, ctx, b.known, audit);
  return Response.json({ facts, missing: missing.map((m) => m.key), masked: maskSummary(audit.masked) });
});
