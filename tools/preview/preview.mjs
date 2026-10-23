// แปลง .docx ในโฟลเดอร์เป็น PDF/PNG ด้วย LibreOffice ใน Docker
//   node tools/preview/preview.mjs out/samples
//   THDOCS_FONT_DIR=D:/FontLibrary  โฟลเดอร์ที่มีไฟล์ TH Sarabun (ไม่รวมใน repo)
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const dir = resolve(process.argv[2] ?? "out/samples");
const fonts = resolve(process.env.THDOCS_FONT_DIR ?? "fonts");
const image = "thdocs-preview";

const run = (args, opts = {}) => {
  const r = spawnSync("docker", args, { stdio: "inherit", ...opts });
  if (r.status !== 0) process.exit(r.status ?? 1);
};

if (!existsSync(dir)) {
  console.error(`ไม่พบ ${dir} — สร้างตัวอย่างก่อนด้วย npm run samples`);
  process.exit(1);
}
if (!existsSync(fonts)) console.error(`WARN: ไม่พบโฟลเดอร์ฟอนต์ ${fonts} (ตั้ง THDOCS_FONT_DIR)`);

const has = spawnSync("docker", ["image", "inspect", image], { stdio: "ignore" });
if (has.status !== 0) run(["build", "-t", image, here]);
run(["run", "--rm", "--network", "none", "-v", `${dir}:/work`, ...(existsSync(fonts) ? ["-v", `${fonts}:/fonts:ro`] : []), image]);
console.log(`ภาพตัวอย่างอยู่ที่ ${resolve(dir, "preview")}`);
