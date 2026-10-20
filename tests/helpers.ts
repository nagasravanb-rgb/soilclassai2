import { deflateSync } from "zlib";

function crc32(buf: Buffer): number {
  let c: number;
  let crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

/** Builds a valid solid-colour RGB PNG. */
export function makePng(width = 64, height = 64, rgb: [number, number, number] = [120, 85, 60]): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const row = Buffer.alloc(1 + width * 3);
  for (let x = 0; x < width; x++) row.set(rgb, 1 + x * 3);
  const raw = Buffer.concat(Array.from({ length: height }, () => row));
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/** Builds a random-noise RGB PNG stored without compression (useful for oversized-file tests). */
export function makeNoisePng(width: number, height: number): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 2;
  const raw = Buffer.alloc(height * (1 + width * 3));
  let seed = 12345;
  for (let i = 0; i < raw.length; i++) {
    if (i % (1 + width * 3) === 0) continue;
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    raw[i] = seed >> 16;
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 0 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/** Minimal JPEG header bytes with a SOF0 frame (enough for signature/dimension checks). */
export function makeJpegHeader(width = 100, height = 80): Buffer {
  const sof = Buffer.from([0xff, 0xc0, 0x00, 0x11, 0x08, height >> 8, height & 0xff, width >> 8, width & 0xff, 0x03, 1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1]);
  return Buffer.concat([Buffer.from([0xff, 0xd8]), Buffer.from([0xff, 0xe0, 0x00, 0x04, 0x00, 0x00]), sof, Buffer.from([0xff, 0xd9])]);
}

export function analyzeRequest(fields: { city?: string; image?: Blob | string; fileName?: string }): Request {
  const form = new FormData();
  if (fields.city !== undefined) form.append("city", fields.city);
  if (fields.image !== undefined) {
    if (typeof fields.image === "string") form.append("image", fields.image);
    else form.append("image", fields.image, fields.fileName ?? "soil.png");
  }
  return new Request("http://localhost/api/analyze", { method: "POST", body: form });
}

export function pngBlob(): Blob {
  return new Blob([new Uint8Array(makePng())], { type: "image/png" });
}
