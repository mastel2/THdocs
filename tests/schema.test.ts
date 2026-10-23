import { describe, expect, it } from "vitest";
import { toLLMSchema } from "@thdocs/core";
import { isoPack } from "@thdocs/templates-iso";
import { thGovPack } from "@thdocs/templates-thgov";

type Node = { type?: string; description?: string; properties?: Record<string, Node>; items?: Node; anyOf?: Node[] };

/** หาช่องที่ไม่มีคำอธิบาย — ฟอร์มบนเว็บใช้คำอธิบายเป็นป้ายภาษาไทย ไม่มีจะขึ้นชื่อในโค้ดแทน (เช่น "role") */
function missing(node: Node, path: string): string[] {
  const out: string[] = [];
  for (const [k, v] of Object.entries(node.properties ?? {})) {
    const p = `${path}.${k}`;
    if (!v.description) out.push(p);
    out.push(...missing(v, p));
    if (v.items) out.push(...missing(v.items, `${p}[]`));
  }
  return out;
}

describe("schema ถ้อยคำของทุกชนิดเอกสาร", () => {
  it.each([...thGovPack.types, ...isoPack.types].map((t) => [t.id, t] as const))("%s: ทุกช่องมีคำอธิบายภาษาไทย", (id, def) => {
    expect(missing(toLLMSchema(def.wordingSchema) as Node, id)).toEqual([]);
  });
});
