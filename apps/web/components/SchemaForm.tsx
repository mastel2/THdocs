"use client";
/**
 * ฟอร์มแก้ถ้อยคำ สร้างจาก JSON Schema ของชนิดเอกสาร — ใช้ได้กับทุกชุดแม่แบบโดยไม่ต้องเขียนฟอร์มเฉพาะ
 *   ข้อความ            → ช่องพิมพ์ (มีตัวเลือกตายตัว → ช่องเลือก)
 *   รายการข้อความ       → รายการ เพิ่ม/ลบ/เลื่อนขึ้นลงได้
 *   รายการแถวข้อมูลล้วน  → ตารางแก้ได้ในตัว (เช่น ขั้นตอน ISO, มาตรการ CAR)
 *   รายการที่ซ้อนกัน     → การ์ดพับได้ (เช่น วาระการประชุมที่มีหลายย่อหน้า)
 */

type Schema = {
  type?: string | string[];
  description?: string;
  enum?: string[];
  properties?: Record<string, Schema>;
  items?: Schema;
  anyOf?: Schema[];
};

/** ช่องที่เว้นว่างได้ (string | null) มาเป็น anyOf — ให้แสดงเหมือนข้อความ */
function norm(s: Schema | undefined): Schema {
  if (!s) return {};
  if (!s.type && s.anyOf) {
    const str = s.anyOf.find((x) => x.type === "string");
    if (str) return { ...str, description: s.description ?? str.description };
  }
  return s;
}

function split(desc: string | undefined, key: string): [string, string] {
  if (!desc) return [key, ""];
  // ตัดคำสั่งที่เขียนไว้ให้ AI เช่น "(ไม่มีให้เป็น [])" ออกจากคำอธิบายที่แสดงผู้ใช้
  const clean = desc.replace(/\s*\([^)]*\[\][^)]*\)/g, "").trim();
  const i = clean.search(/[:(—]/);
  return i > 0 ? [clean.slice(0, i).trim(), clean.slice(i).replace(/^[:—]\s*/, "").trim()] : [clean, ""];
}

function empty(s: Schema | undefined): unknown {
  if (s?.type === "object") return Object.fromEntries(Object.entries(s.properties ?? {}).map(([k, v]) => [k, empty(v)]));
  if (s?.type === "array") return [];
  if (s?.enum?.length) return s.enum[0];
  return "";
}

const isText = (s: Schema | undefined) => norm(s).type === "string";
/** แถวข้อมูลล้วน: object ที่ทุกช่องเป็นข้อความ (รวมช่องเลือก/ช่องเว้นว่างได้) — แสดงเป็นตารางได้ */
const isFlatRow = (s: Schema | undefined) => s?.type === "object" && !!s.properties && Object.values(s.properties).every(isText);

function move<T>(arr: T[], i: number, d: -1 | 1): T[] {
  const j = i + d;
  if (j < 0 || j >= arr.length) return arr;
  const out = [...arr];
  [out[i], out[j]] = [out[j]!, out[i]!];
  return out;
}

function RowTools({ i, n, onMove, onRemove, what }: { i: number; n: number; onMove: (d: -1 | 1) => void; onRemove: () => void; what: string }) {
  // preventDefault: ปุ่มในหัวการ์ด (<summary>) จะได้ไม่พับ/กางการ์ดไปด้วย
  const act = (fn: () => void) => (e: React.MouseEvent) => {
    e.preventDefault();
    fn();
  };
  return (
    <span className="sf-tools">
      <button type="button" className="icon" disabled={i === 0} onClick={act(() => onMove(-1))} aria-label={`เลื่อน${what}ที่ ${i + 1} ขึ้น`}>↑</button>
      <button type="button" className="icon" disabled={i === n - 1} onClick={act(() => onMove(1))} aria-label={`เลื่อน${what}ที่ ${i + 1} ลง`}>↓</button>
      <button type="button" className="icon danger" onClick={act(onRemove)} aria-label={`ลบ${what}ที่ ${i + 1}`}>✕</button>
    </span>
  );
}

function TextInput({ schema: raw, value, onChange, label }: { schema: Schema; value: unknown; onChange: (v: unknown) => void; label?: string }) {
  const schema = norm(raw);
  const v = typeof value === "string" ? value : "";
  if (schema.enum?.length) {
    return (
      <select value={v} onChange={(e) => onChange(e.target.value)} aria-label={label}>
        {schema.enum.map((o) => <option key={o}>{o}</option>)}
      </select>
    );
  }
  return <textarea value={v} onChange={(e) => onChange(e.target.value)} rows={1} aria-label={label} />;
}

interface Props {
  schema: Schema;
  value: unknown;
  onChange: (v: unknown) => void;
  label?: string;
  hint?: string;
}

export function SchemaForm({ schema: raw, value, onChange, label, hint }: Props) {
  const schema = norm(raw);
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
    const items = schema.items ?? {};
    const set = (i: number, v: unknown) => onChange(arr.map((x, j) => (j === i ? v : x)));
    const remove = (i: number) => onChange(arr.filter((_, j) => j !== i));
    const add = () => onChange([...arr, empty(items)]);
    const legend = (
      <>
        <legend>{label}</legend>
        {hint && <p className="hint">{hint}</p>}
      </>
    );

    // ตารางแก้ได้ในตัว
    if (isFlatRow(items)) {
      const cols = Object.entries(items.properties!).map(([k, s]) => ({ k, s, title: split(s.description, k)[0] }));
      return (
        <fieldset className="sf-array">
          {legend}
          <div className="sf-table-wrap">
            <table className="sf-table">
              <thead>
                <tr>
                  <th className="sf-no">ที่</th>
                  {cols.map((c) => <th key={c.k}>{c.title}</th>)}
                  <th className="sf-act"><span className="sr-only">จัดการแถว</span></th>
                </tr>
              </thead>
              <tbody>
                {arr.map((row, i) => {
                  const r = (row ?? {}) as Record<string, unknown>;
                  return (
                    <tr key={i}>
                      <td className="sf-no">{i + 1}</td>
                      {cols.map((c) => (
                        <td key={c.k}>
                          <TextInput schema={c.s} value={r[c.k]} label={`${c.title} แถวที่ ${i + 1}`} onChange={(v) => set(i, { ...r, [c.k]: v })} />
                        </td>
                      ))}
                      <td className="sf-act"><RowTools i={i} n={arr.length} what="แถว" onMove={(d) => onChange(move(arr, i, d))} onRemove={() => remove(i)} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <button type="button" className="ghost small" onClick={add}>+ เพิ่มแถว</button>
        </fieldset>
      );
    }

    // รายการข้อความ
    if (isText(items)) {
      return (
        <fieldset className="sf-array">
          {legend}
          {arr.map((item, i) => (
            <div className="sf-item" key={i}>
              <span className="sf-no">{i + 1}</span>
              <TextInput schema={items} value={item} label={`${label ?? ""} ข้อที่ ${i + 1}`} onChange={(v) => set(i, v)} />
              <RowTools i={i} n={arr.length} what="ข้อ" onMove={(d) => onChange(move(arr, i, d))} onRemove={() => remove(i)} />
            </div>
          ))}
          <button type="button" className="ghost small" onClick={add}>+ เพิ่ม</button>
        </fieldset>
      );
    }

    // การ์ดพับได้ สำหรับรายการที่ซ้อนกัน — หัวการ์ดใช้ข้อความช่องแรก
    return (
      <fieldset className="sf-array">
        {legend}
        {arr.map((item, i) => {
          const first = Object.values((item ?? {}) as Record<string, unknown>).find((v) => typeof v === "string") as string | undefined;
          return (
            <details className="sf-card" key={i} open={arr.length <= 2}>
              <summary>
                <span className="sf-card-title">{i + 1}. {first?.trim() || "(ยังไม่มีข้อความ)"}</span>
                <RowTools i={i} n={arr.length} what="รายการ" onMove={(d) => onChange(move(arr, i, d))} onRemove={() => remove(i)} />
              </summary>
              <SchemaForm schema={items} value={item} onChange={(v) => set(i, v)} />
            </details>
          );
        })}
        <button type="button" className="ghost small" onClick={add}>+ เพิ่ม</button>
      </fieldset>
    );
  }

  return (
    <label className="sf-field">
      {label && <span className="sf-label">{label}</span>}
      {hint && <span className="hint">{hint}</span>}
      <TextInput schema={schema} value={value} onChange={onChange} />
    </label>
  );
}
