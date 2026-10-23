/** PNG เล็ก ๆ ที่ไม่ต้องพึ่งไลบรารี: อ่านขนาดภาพ และสร้างกรอบแทนตรา */
import type { deflateSync as Deflate } from "node:zlib";

/** zlib ของ Node หาตอนใช้งาน (ไม่ import ตรง) เพื่อให้ไฟล์นี้ถูกรวมเข้าชุดของเบราว์เซอร์ได้ — drawPng ใช้ฝั่งเซิร์ฟเวอร์เท่านั้น */
function deflateSync(raw: Uint8Array): Uint8Array {
  const z = (globalThis as { process?: { getBuiltinModule?: (n: string) => { deflateSync: typeof Deflate } } }).process?.getBuiltinModule?.("node:zlib");
  if (!z) throw new Error("drawPng ใช้ได้เฉพาะบน Node");
  return z.deflateSync(raw);
}

export function pngSize(buf: Uint8Array): { width: number; height: number } {
  const v = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  if (buf.length < 24 || v.getUint32(0) !== 0x89504e47) throw new Error("ไฟล์ตราต้องเป็น PNG");
  return { width: v.getUint32(16), height: v.getUint32(20) };
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
const PLACEHOLDER_180x200 = "iVBORw0KGgoAAAANSUhEUgAAALQAAADICAYAAABBLcuIAAACWklEQVR4nO3bQYrCQBBA0dz/ALmubi0MGqKQ+H0PZjnNDPxFd6d6Wdf1tudn2cl61jtzvV0LVv5Z6/XXe7to6Z+1Xn+95cgvw5WMhgXNrxM0KYImRdCkbAZ99h8FRz0FffYfBJ+wyyBF0KSImRQxAwAAMDkpkuEejwxfWUgRNBXGR8kwD02GAX9SBE2KoEkRNCneFJLiTSEpdhmkCJoUMZMiZgAAACYnRTLc45HhKwspgqbC+CgZ5qHJMOBPiqBJETQpgibFm0JSvCkkxS6DFEGTImZSxAwAAMDkpEiGezwyfGUhRdBUGB8lwzw0GQb8SRE0KYImRdCkeFNIijeFpNhlkCJoUsRMipgBAACYnBTJcI9Hhq8spAiaCuOjZJiHJsOAPymCJkXQpAiaFG8KSfGmkBS7DFIETYqYSREzAAAAk5MiGe7xyPCVhRRBU2F8lAzz0GQY8CdF0KQImhRBk+JNISneFJJil0GKoEkRMyliBgAAYHJSJMM9Hhm+spAiaCqMj5JhHpoMA/6kCJoUQZMiaFK8KSTFm0JS7DJIETQpYiZFzAAAAExOimS4xyPDVxZSBE2F8VEyzEOTYcCfFEGTImhSBE2KN4WkeFNIil0GKYImRcykiBkAAIDJSZEM93hk+MpCiqCpMD5KhnloMgz4kyJoUgRNiqBJ8aaQFG8KSbHLIEXQpIiZFDEDAAAwOSmS4R6PDF9ZSBE0FcZHyTAPTYYBf1IETYqgSRE0Kd4UkuJNISl2GaQImhQxkyJmAAD4ksfrj1c/1rPe5de79B9nPeuJ2Xr/uN4dFzka2rXLgacAAAAASUVORK5CYII=";

export function placeholderPng(width = 180, height = 200): Uint8Array {
  if (width === 180 && height === 200) return Uint8Array.from(atob(PLACEHOLDER_180x200), (c) => c.charCodeAt(0)); // สร้างไว้ล่วงหน้า ไม่ต้องใช้ zlib ในเบราว์เซอร์
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
    chunk("IDAT", Buffer.from(deflateSync(raw))),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}
