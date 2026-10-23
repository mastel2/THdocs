/** PNG เล็ก ๆ ที่ไม่ต้องพึ่งไลบรารี: อ่านขนาดภาพ และสร้างกรอบแทนตรา */
import { deflateSync } from "node:zlib";

export function pngSize(buf: Buffer): { width: number; height: number } {
  if (buf.length < 24 || buf.readUInt32BE(0) !== 0x89504e47) throw new Error("ไฟล์ตราต้องเป็น PNG");
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

/** สร้าง PNG จากฟังก์ชันสีรายพิกเซล (RGBA) — ใช้กับภาพเล็ก ๆ เช่น กรอบแทนตรา ไอคอน */
export function drawPng(width: number, height: number, pixel: (x: number, y: number) => [number, number, number, number] | null): Buffer {
  const row = width * 4 + 1;
  const raw = Buffer.alloc(row * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const c = pixel(x, y);
      if (c) raw.set(c, y * row + 1 + x * 4);
    }
  }
  return encode(width, height, raw);
}

/** กรอบเส้นประสีเทาบนพื้นโปร่ง — แสดงตำแหน่งตราเมื่อผู้ใช้ยังไม่ได้ให้ไฟล์ตรา */
export function placeholderPng(width = 180, height = 200): Buffer {
  return drawPng(width, height, (x, y) => {
    const edge = x < 3 || y < 3 || x >= width - 3 || y >= height - 3;
    return edge && Math.floor((x + y) / 10) % 2 === 0 ? [150, 150, 150, 255] : null;
  });
}

function encode(width: number, height: number, raw: Buffer): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.set([8, 6, 0, 0, 0], 8); // 8-bit RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}
