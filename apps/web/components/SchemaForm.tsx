"use client";
/** ฟอร์มแก้ถ้อยคำ สร้างจาก JSON Schema ของชนิดเอกสาร — ใช้ได้กับทุกชุดแม่แบบโดยไม่ต้องเขียนฟอร์มเฉพาะ */

type Schema = {
  type?: string | string[];
  description?: string;
  properties?: Record<string, Schema>;
  items?: Schema;
};

function split(desc: string | undefined, key: string): [string, string] {
  if (!desc) return [key, ""];
  // ตัดคำสั่งที่เขียนไว้ให้ AI เช่น "(ไม่มีให้เป็น [])" ออกจากคำอธิบายที่แสดงผู้ใช้
  const clean = desc.replace(/\s*\([^)]*\[\][^)]*\)/g, "").trim();
  const i = clean.search(/[:(]/);
  return i > 0 ? [clean.slice(0, i).trim(), clean.slice(i).replace(/^:\s*/, "").trim()] : [clean, ""];
}

function empty(s: Schema | undefined): unknown {
  if (s?.type === "object") return Object.fromEntries(Object.entries(s.properties ?? {}).map(([k, v]) => [k, empty(v)]));
  if (s?.type === "array") return [];
  return "";
}

interface Props {
  schema: Schema;
  value: unknown;
  onChange: (v: unknown) => void;
  label?: string;
  hint?: string;
}

export function SchemaForm({ schema, value, onChange, label, hint }: Props) {
  if (schema.type === "object" && schema.properties) {
    const obj = (value ?? {}) as Record<string, unknown>;
    return (
      <div className="sf-object">
        {Object.entries(schema.properties).map(([k, s]) => {
          const [l, h] = split(s.description, k);
          return <SchemaForm key={k} schema={s} value={obj[k]} label={l} hint={h} onChange={(v) => onChange({ ...obj, [k]: v })} />;
        })}
      </div>
    );
  }

  if (schema.type === "array") {
    const arr = Array.isArray(value) ? value : [];
    const set = (i: number, v: unknown) => onChange(arr.map((x, j) => (j === i ? v : x)));
    return (
      <fieldset className="sf-array">
        <legend>{label}</legend>
        {hint && <p className="hint">{hint}</p>}
        {arr.map((item, i) => (
          <div className="sf-item" key={i}>
            <SchemaForm schema={schema.items ?? {}} value={item} onChange={(v) => set(i, v)} label={`${i + 1}`} />
            <button type="button" className="ghost small" onClick={() => onChange(arr.filter((_, j) => j !== i))} aria-label={`ลบรายการที่ ${i + 1}`}>
              ลบ
            </button>
          </div>
        ))}
        <button type="button" className="ghost small" onClick={() => onChange([...arr, empty(schema.items)])}>
          + เพิ่ม
        </button>
      </fieldset>
    );
  }

  return (
    <label className="sf-field">
      {label && <span className="sf-label">{label}</span>}
      {hint && <span className="hint">{hint}</span>}
      <textarea value={typeof value === "string" ? value : ""} onChange={(e) => onChange(e.target.value)} rows={1} />
    </label>
  );
}
