export type SupportedMime = "image/jpeg" | "image/png" | "image/webp";

export const SUPPORTED_MIME_TYPES: readonly SupportedMime[] = ["image/jpeg", "image/png", "image/webp"];
const MIN_DIMENSION = 32;
const MAX_DIMENSION = 12_000;

export class ImageValidationError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "ImageValidationError";
  }
}

export function detectImageType(bytes: Uint8Array): SupportedMime | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (bytes.length >= 8 && png.every((b, i) => bytes[i] === b)) return "image/png";
  const ascii = (start: number, end: number) => String.fromCharCode(...Array.from(bytes.subarray(start, end)));
  if (bytes.length >= 12 && ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "image/webp";
  return null;
}

export function readDimensions(bytes: Uint8Array, mime: SupportedMime): { width: number; height: number } | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (mime === "image/png") {
    if (bytes.length < 24) return null;
    return { width: view.getUint32(16), height: view.getUint32(20) };
  }
  if (mime === "image/webp") {
    if (bytes.length < 30) return null;
    const chunk = String.fromCharCode(...Array.from(bytes.subarray(12, 16)));
    if (chunk === "VP8X") {
      const u24 = (o: number) => bytes[o] | (bytes[o + 1] << 8) | (bytes[o + 2] << 16);
      return { width: 1 + u24(24), height: 1 + u24(27) };
    }
    if (chunk === "VP8 ") {
      if (bytes[23] !== 0x9d || bytes[24] !== 0x01 || bytes[25] !== 0x2a) return null;
      return { width: view.getUint16(26, true) & 0x3fff, height: view.getUint16(28, true) & 0x3fff };
    }
    if (chunk === "VP8L") {
      if (bytes[20] !== 0x2f) return null;
      const b = (i: number) => bytes[21 + i];
      return { width: 1 + (((b(1) & 0x3f) << 8) | b(0)), height: 1 + (((b(3) & 0xf) << 10) | (b(2) << 2) | ((b(1) & 0xc0) >> 6)) };
    }
    return null;
  }
  let offset = 2;
  while (offset + 4 <= bytes.length) {
    if (bytes[offset] !== 0xff) return null;
    const marker = bytes[offset + 1];
    offset += 2;
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    if (marker === 0xd9 || marker === 0xda) return null;
    if (offset + 2 > bytes.length) return null;
    const segmentLength = view.getUint16(offset);
    if (segmentLength < 2 || offset + segmentLength > bytes.length) return null;
    const isStartOfFrame = [0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker);
    if (isStartOfFrame && segmentLength >= 7) {
      return { height: view.getUint16(offset + 3), width: view.getUint16(offset + 5) };
    }
    offset += segmentLength;
  }
  return null;
}

export interface ValidatedImage {
  bytes: Uint8Array;
  mime: SupportedMime;
  width: number;
  height: number;
}

/** Validates image bytes by signature and header structure; the client-declared MIME type is not trusted. */
export function validateImageBytes(bytes: Uint8Array, maxBytes: number): ValidatedImage {
  if (bytes.length === 0) throw new ImageValidationError("The selected image is empty.", 400);
  if (bytes.length > maxBytes) {
    throw new ImageValidationError(`Image is larger than the ${Math.round(maxBytes / 1024 / 1024)} MB limit.`, 413);
  }
  const mime = detectImageType(bytes);
  if (!mime) throw new ImageValidationError("Unsupported file. Please use a JPEG, PNG, or WebP photo.", 415);
  const dims = readDimensions(bytes, mime);
  if (!dims) throw new ImageValidationError("The image appears to be corrupted or incomplete. Please choose another photo.", 400);
  if (dims.width < MIN_DIMENSION || dims.height < MIN_DIMENSION || dims.width > MAX_DIMENSION || dims.height > MAX_DIMENSION) {
    throw new ImageValidationError(`Image dimensions must be between ${MIN_DIMENSION} and ${MAX_DIMENSION} pixels per side.`, 400);
  }
  return { bytes, mime, ...dims };
}
