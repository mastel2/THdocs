"use client";
import type { OrgProfile } from "@thdocs/core";
import type { LLMChoice, ProviderInfo } from "../lib/registry";

const MAX_EMBLEM = 600_000;

interface ProfileProps {
  profile: OrgProfile;
  onChange: (p: OrgProfile) => void;
  emblem: string | null;
  onEmblem: (dataUrl: string | null) => void;
}

export function ProfileSettings({ profile: p, onChange, emblem, onEmblem }: ProfileProps) {
  const set = (patch: Partial<OrgProfile>) => onChange({ ...p, ...patch });
  const signer = p.signer ?? { name: "", position: [] };

  const pickEmblem = (f: File | undefined) => {
    if (!f) return;
    if (f.type !== "image/png") return alert("ตราต้องเป็นไฟล์ PNG");
    if (f.size > MAX_EMBLEM) return alert("ไฟล์ตราใหญ่เกิน 600 KB");
    const r = new FileReader();
    r.onload = () => onEmblem(String(r.result));
    r.readAsDataURL(f);
  };

  return (
    <div className="form">
      <p className="hint">ข้อมูลนี้เก็บในเบราว์เซอร์เครื่องนี้เท่านั้น และใช้เติมเอกสารแบบตายตัว ไม่ให้ AI เดา</p>
      <label>ชื่อหน่วยงาน<input value={p.orgName} onChange={(e) => set({ orgName: e.target.value })} placeholder="สำนักงาน..." /></label>
      <label>ส่วนงานเจ้าของเรื่อง<input value={p.unit} onChange={(e) => set({ unit: e.target.value })} placeholder="กอง..." /></label>
      <label>
        ที่ตั้ง (บรรทัดละรายการ)
        <textarea
          rows={3}
          value={p.address.join("\n")}
          onChange={(e) => set({ address: e.target.value.split("\n") })}
          onBlur={(e) => set({ address: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean) })}
        />
      </label>
      <div className="row">
        <label>โทรศัพท์<input value={p.phone ?? ""} onChange={(e) => set({ phone: e.target.value })} /></label>
        <label>อีเมล<input value={p.email ?? ""} onChange={(e) => set({ email: e.target.value })} /></label>
      </div>
      <div className="row">
        <label>รหัสหนังสือ<input value={p.docNoPrefix ?? ""} onChange={(e) => set({ docNoPrefix: e.target.value })} placeholder="ศธ ๐๒๐๑" /></label>
        <label>
          คำเรียกส่วนงาน
          <select value={p.unitLabel ?? "ส่วนราชการ"} onChange={(e) => set({ unitLabel: e.target.value })}>
            <option>ส่วนราชการ</option>
            <option>หน่วยงาน</option>
          </select>
        </label>
      </div>
      <label>ผู้ลงนาม<input value={signer.name} onChange={(e) => set({ signer: { ...signer, name: e.target.value } })} placeholder="ชื่อเต็ม ไม่ต้องใส่วงเล็บ" /></label>
      <label>
        ตำแหน่ง (บรรทัดละตำแหน่ง)
        <textarea rows={2} value={signer.position.join("\n")} onChange={(e) => set({ signer: { ...signer, position: e.target.value.split("\n") } })} />
      </label>
      <div className="emblem-row">
        {emblem ? <img src={emblem} alt="ตราหน่วยงาน" /> : <span className="emblem-empty" aria-hidden />}
        <label className="file">
          ตราหน่วยงาน (PNG)
          <input type="file" accept="image/png" onChange={(e) => pickEmblem(e.target.files?.[0])} />
        </label>
        {emblem && <button type="button" className="ghost small" onClick={() => onEmblem(null)}>ลบตรา</button>}
      </div>
      <p className="hint">ระบบไม่มีตราครุฑให้ — หน่วยงานต้องใช้ไฟล์ตราของตนเอง ถ้าไม่ใส่ จะแสดงกรอบแทนตรา</p>
    </div>
  );
}

interface LLMProps {
  providers: ProviderInfo[];
  choice: LLMChoice;
  onChange: (c: LLMChoice) => void;
  remember: boolean;
  onRemember: (v: boolean) => void;
}

export function LLMSettings({ providers, choice, onChange, remember, onRemember }: LLMProps) {
  const info = providers.find((p) => p.id === choice.provider);
  return (
    <div className="form">
      <label>
        ผู้ให้บริการ AI
        <select value={choice.provider} onChange={(e) => onChange({ provider: e.target.value })}>
          {providers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </label>
      {info && (
        <p className={info.external ? "notice warn" : "notice ok"}>
          {info.external
            ? `คำขอและข้อมูลในเอกสารจะถูกส่งไปยัง ${info.name} — ห้ามใช้กับเอกสารชั้นความลับ`
            : "ประมวลผลในเครื่อง/เครือข่ายของคุณ ข้อมูลไม่ออกไปภายนอก ใช้กับเอกสารชั้นความลับได้"}
        </p>
      )}
      <label>
        โมเดล{info?.needsModel ? "" : " (ไม่บังคับ)"}
        <input value={choice.model ?? ""} onChange={(e) => onChange({ ...choice, model: e.target.value })} placeholder={info?.defaultModel ?? (choice.provider === "ollama" ? "เช่น qwen3.5:9b" : "ชื่อโมเดล")} />
      </label>
      {info?.needsUrl && (
        <label>Base URL<input value={choice.baseUrl ?? ""} onChange={(e) => onChange({ ...choice, baseUrl: e.target.value })} placeholder="https://.../v1" /></label>
      )}
      {(info?.needsKey || info?.needsUrl) && (
        <>
          <label>
            API key
            <input type="password" autoComplete="off" value={choice.apiKey ?? ""} onChange={(e) => onChange({ ...choice, apiKey: e.target.value })} />
          </label>
          <label className="check">
            <input type="checkbox" checked={remember} onChange={(e) => onRemember(e.target.checked)} />
            จำ API key ไว้ในเบราว์เซอร์เครื่องนี้
          </label>
          <p className="hint">key ส่งไปกับคำขอแต่ละครั้งเพื่อเรียก AI เท่านั้น เซิร์ฟเวอร์ไม่เก็บ</p>
        </>
      )}
    </div>
  );
}
