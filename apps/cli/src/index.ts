#!/usr/bin/env node
/**
 * THdocs CLI
 *
 *   thdocs types
 *   thdocs draft "<คำขอ>" -t memo [--provider ollama --model qwen3.6:35b-a3b-q4_K_M] [-o out.docx]
 *   thdocs revise ร่าง.json "<คำสั่งแก้>"
 *   thdocs render ร่าง.json [-o out.docx]
 *   thdocs check ร่าง.json
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { createInterface } from "node:readline/promises";
import { parseArgs } from "node:util";
import {
  ConfidentialError,
  assembleDraft,
  check,
  contextFromDraft,
  draft,
  extractFacts,
  maskSummary,
  missingFacts,
  revise,
  summarize,
  type Context,
  type DocTypeDef,
  type DraftFile,
  type Facts,
  type OrgProfile,
  type PrivacyAudit,
  type Secrecy,
  type Speed,
} from "@thdocs/core";
import { LLMError, PROVIDERS, createLLM } from "@thdocs/llm";
import { renderDocx } from "@thdocs/render-docx";
import { thGovPack } from "@thdocs/templates-thgov";

const PACKS = [thGovPack];
const TYPES = PACKS.flatMap((p) => p.types);
const SPEEDS = ["ด่วนที่สุด", "ด่วนมาก", "ด่วน"];
const SECRECY = ["ลับที่สุด", "ลับมาก", "ลับ"];
const DEFAULT_PROFILE = "thdocs.profile.json";

const HELP = `THdocs — ร่างเอกสารด้วย AI แล้วจัดรูปแบบตามแบบที่กำหนด

คำสั่ง:
  types                                แสดงชนิดเอกสารที่รองรับ
  draft "<คำขอ>" -t <ชนิด>              ร่างใหม่ (ถามข้อมูลที่ขาดก่อนร่าง)
  revise <ร่าง.json> "<คำสั่งแก้>"        แก้ถ้อยคำ
  render <ร่าง.json>                    สร้าง .docx จากร่าง (ไม่เรียก AI)
  check <ร่าง.json>                     ตรวจตามระเบียบ

ตัวเลือก:
  -t, --type <ชนิด>         ${TYPES.map((t) => t.id).join(" | ")}
  -o, --out <ไฟล์.docx>
      --json-out <ไฟล์>     ที่เก็บร่าง (ค่าเริ่มต้น: ชื่อเดียวกับ .docx แต่เป็น .json)
      --provider <ชื่อ>      ${PROVIDERS.join(" | ")} (ค่าเริ่มต้น THDOCS_LLM หรือ anthropic)
      --model <ชื่อ>
      --base-url <url>      สำหรับ custom / ปรับ endpoint
      --profile <ไฟล์>      ข้อมูลหน่วยงาน (ค่าเริ่มต้น ${DEFAULT_PROFILE})
      --fact key=value      กำหนดข้อเท็จจริงเอง (ใส่ซ้ำได้)
      --speed <ระดับ>       ${SPEEDS.join(" | ")}
      --secrecy <ระดับ>     ${SECRECY.join(" | ")} (ห้ามส่ง AI ภายนอก)
      --emblem <ไฟล์.png>   ตราหน่วยงาน (ไม่มี = กรอบแทนตรา)
      --latin-digits        ใช้เลขอารบิก
      --no-ask              ไม่ถามกลับ ช่องที่ขาดใส่ [ระบุ]
`;

function fail(msg: string, code = 2): never {
  console.error(msg);
  process.exit(code);
}

function findType(id: string | undefined): DocTypeDef {
  const def = TYPES.find((t) => t.id === id);
  if (!def) fail(`ไม่รู้จักชนิดเอกสาร '${id ?? ""}' — ดู: thdocs types`);
  return def;
}

function loadProfile(path: string | undefined): OrgProfile {
  const p = path ?? (existsSync(DEFAULT_PROFILE) ? DEFAULT_PROFILE : undefined);
  const base: OrgProfile = { orgName: "[ระบุ: ชื่อหน่วยงาน]", unit: "[ระบุ: ส่วนงานเจ้าของเรื่อง]", address: [] };
  if (!p) return base;
  return { ...base, ...(JSON.parse(readFileSync(p, "utf8")) as Partial<OrgProfile>) };
}

function readDraft(path: string | undefined): DraftFile {
  if (!path) fail("ต้องระบุไฟล์ร่าง .json");
  const f = JSON.parse(readFileSync(path, "utf8")) as DraftFile;
  if (f.thdocs !== 1) fail(`${path} ไม่ใช่ไฟล์ร่างของ THdocs`);
  return f;
}

function parseFacts(list: string[] = []): Facts {
  return Object.fromEntries(
    list.map((kv) => {
      const i = kv.indexOf("=");
      if (i < 1) fail(`--fact ต้องอยู่ในรูป key=value: ${kv}`);
      return [kv.slice(0, i), kv.slice(i + 1)];
    }),
  );
}

async function ask(def: DocTypeDef, facts: Facts): Promise<Facts> {
  const missing = missingFacts(def, facts);
  if (!missing.length) return facts;
  const rl = createInterface({ input: process.stdin, output: process.stderr });
  console.error(`ต้องการข้อมูลเพิ่ม ${missing.length} รายการ (กด Enter เพื่อเว้นไว้เป็น [ระบุ]):`);
  const out = { ...facts };
  for (const f of missing) {
    const a = (await rl.question(`  ${f.question}${f.example ? ` เช่น ${f.example}` : ""}: `)).trim();
    if (a) out[f.key] = a;
  }
  rl.close();
  return out;
}

async function writeOutputs(def: DocTypeDef, file: DraftFile, ctx: Context, out: string | undefined, jsonOut: string | undefined, emblem?: string) {
  const docxPath = out ?? `${def.name}.docx`;
  const jsonPath = jsonOut ?? docxPath.replace(/\.docx$/i, "") + ".json";
  const doc = assembleDraft(def, file, ctx);
  const emblemPng = emblem ?? ctx.profile.emblemPng;
  writeFileSync(docxPath, await renderDocx(def.layout(doc, ctx), emblemPng ? { emblemPng } : {}));
  writeFileSync(jsonPath, JSON.stringify(file, null, 2));
  report(def, doc, ctx, `สร้าง ${docxPath} (ร่างเก็บที่ ${jsonPath})`);
}

function reportMasked(audit: PrivacyAudit, provider: string) {
  if (audit.masked.length) console.error(`ปิดบังข้อมูลส่วนบุคคลก่อนส่งให้ ${provider}: ${maskSummary(audit.masked)}`);
}

function report(def: DocTypeDef, doc: unknown, ctx: Context, head: string) {
  const s = summarize(check(def, doc, ctx));
  console.log(`${head}  — error ${s.errors} · warning ${s.warnings} · info ${s.infos}`);
  for (const f of s.findings) {
    console.log(`  [${f.level}] ${f.message}${f.where ? `  (${f.where})` : ""}${f.ref ? `  — ${f.ref}` : ""}`);
  }
  if (s.errors) process.exitCode = 1;
}

async function main() {
  const { values: v, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      type: { type: "string", short: "t" },
      out: { type: "string", short: "o" },
      "json-out": { type: "string" },
      provider: { type: "string" },
      model: { type: "string" },
      "base-url": { type: "string" },
      profile: { type: "string" },
      fact: { type: "string", multiple: true },
      speed: { type: "string" },
      secrecy: { type: "string" },
      emblem: { type: "string" },
      "latin-digits": { type: "boolean" },
      "no-ask": { type: "boolean" },
      help: { type: "boolean", short: "h" },
    },
  });
  const [cmd, a1, a2] = positionals;
  if (v.help || !cmd) return console.log(HELP);
  if (existsSync(".env")) process.loadEnvFile(".env");

  if (v.speed && !SPEEDS.includes(v.speed)) fail(`--speed ต้องเป็น ${SPEEDS.join(" | ")}`);
  if (v.secrecy && !SECRECY.includes(v.secrecy)) fail(`--secrecy ต้องเป็น ${SECRECY.join(" | ")}`);
  const profile = loadProfile(v.profile);
  const llm = () =>
    createLLM({
      provider: v.provider ?? process.env.THDOCS_LLM ?? "anthropic",
      ...(v.model ? { model: v.model } : {}),
      ...(v["base-url"] ? { baseUrl: v["base-url"] } : {}),
    });

  switch (cmd) {
    case "types":
      for (const p of PACKS) {
        console.log(p.name);
        for (const t of p.types) console.log(`  ${t.id.padEnd(16)} ${t.name} — ${t.description}`);
      }
      return;

    case "draft": {
      if (!a1) fail('ต้องระบุคำขอ เช่น thdocs draft "ขออนุมัติจัดอบรม..." -t memo');
      const def = findType(v.type);
      const ctx: Context = {
        profile,
        options: {
          ...(v.speed ? { speed: v.speed as Speed } : {}),
          ...(v.secrecy ? { secrecy: v.secrecy as Secrecy } : {}),
          ...(v["latin-digits"] ? { thaiDigits: false } : {}),
        },
      };
      const model = llm();
      console.error(`AI: ${model.id} ${model.model}${model.external ? " (ข้อมูลออกนอกเครื่อง)" : " (ในเครื่อง)"}`);
      const audit: PrivacyAudit = { masked: [] };
      let { facts } = await extractFacts(model, def, a1, ctx, parseFacts(v.fact), audit);
      if (!v["no-ask"] && process.stdin.isTTY) facts = await ask(def, facts);
      console.error(`กำลังร่าง${def.name}…`);
      const file = await draft(model, def, a1, facts, ctx, audit);
      reportMasked(audit, model.id);
      return writeOutputs(def, file, ctx, v.out, v["json-out"], v.emblem);
    }

    case "revise": {
      if (!a2) fail('ต้องระบุคำสั่งแก้ เช่น thdocs revise ร่าง.json "ทำให้สั้นลง"');
      const file = readDraft(a1);
      const def = findType(file.type);
      const ctx = contextFromDraft(file, profile);
      const audit: PrivacyAudit = { masked: [] };
      const model = llm();
      const revised = await revise(model, def, file, a2, ctx, audit);
      reportMasked(audit, model.id);
      return writeOutputs(def, revised, ctx, v.out ?? a1!.replace(/\.json$/i, ".docx"), v["json-out"] ?? a1, v.emblem);
    }

    case "render": {
      const file = readDraft(a1);
      const def = findType(file.type);
      return writeOutputs(def, file, contextFromDraft(file, profile), v.out ?? a1!.replace(/\.json$/i, ".docx"), a1, v.emblem);
    }

    case "check": {
      const file = readDraft(a1);
      const def = findType(file.type);
      const ctx = contextFromDraft(file, profile);
      return report(def, assembleDraft(def, file, ctx), ctx, a1!);
    }

    default:
      fail(`ไม่รู้จักคำสั่ง '${cmd}'\n\n${HELP}`);
  }
}

main().catch((e: unknown) => {
  if (e instanceof ConfidentialError) fail(`ไม่ส่ง: ${e.message}`, 3);
  if (e instanceof LLMError || e instanceof Error) fail(`ผิดพลาด: ${e.message}`);
  throw e;
});
