import { detectImageType, SUPPORTED_MIME_TYPES } from "../image";

export interface ClientImageCheck {
  ok: boolean;
  error?: string;
  /** The blob to upload: the original file, or a downscaled JPEG copy if the original exceeded the limit. */
  blob?: Blob;
  resized?: boolean;
}

/** Largest original file we will try to downscale in the browser. */
export const MAX_ORIGINAL_BYTES = 30 * 1024 * 1024;

async function encodeJpeg(bitmap: ImageBitmap, maxSide: number, quality: number): Promise<Blob | null> {
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return new Promise(resolve => canvas.toBlob(resolve, "image/jpeg", quality));
}

/** Client-side pre-check (the server re-validates every upload). Oversized photos are downscaled. */
export async function checkImageFile(file: Blob, maxBytes: number): Promise<ClientImageCheck> {
  if (file.size === 0) return { ok: false, error: "The selected file is empty." };
  const limitMb = Math.round(maxBytes / 1024 / 1024);
  if (file.size > MAX_ORIGINAL_BYTES) {
    return { ok: false, error: `This image is too large (over ${MAX_ORIGINAL_BYTES / 1024 / 1024} MB). Please choose a smaller photo.` };
  }
  const head = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const mime = detectImageType(head);
  if (!mime || !SUPPORTED_MIME_TYPES.includes(mime)) {
    return { ok: false, error: "Unsupported file. Please choose a JPEG, PNG, or WebP photo." };
  }
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return { ok: false, error: "This image could not be read. It may be corrupted — please choose another photo." };
  }
  try {
    if (file.size <= maxBytes) return { ok: true, blob: file, resized: false };
    for (const [side, quality] of [[2560, 0.88], [2048, 0.85], [1600, 0.8], [1280, 0.75]] as const) {
      const blob = await encodeJpeg(bitmap, side, quality);
      if (blob && blob.size > 0 && blob.size <= maxBytes) return { ok: true, blob, resized: true };
    }
    return { ok: false, error: `This image is larger than the ${limitMb} MB limit and could not be reduced. Please choose a smaller photo.` };
  } finally {
    bitmap.close();
  }
}

/** Renders a downscaled JPEG data URL (used for history thumbnails and reports). */
export async function toScaledDataUrl(file: Blob, maxSide: number, quality = 0.8): Promise<string | null> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    return canvas.toDataURL("image/jpeg", quality);
  } catch {
    return null;
  }
}

export function downloadText(content: string, fileName: string, mime: string): void {
  const url = URL.createObjectURL(new Blob([content], { type: mime }));
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
