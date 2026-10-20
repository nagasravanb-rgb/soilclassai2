import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 30;

const MAX_BYTES = 5 * 1024 * 1024;
const MAX_DIMENSION = 20_000;
const MIME_BY_SIGNATURE: Record<string, string> = {
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

function detectImageType(bytes: Buffer): string | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return MIME_BY_SIGNATURE.jpeg;
  }
  if (
    bytes.length >= 8 &&
    bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  ) {
    return MIME_BY_SIGNATURE.png;
  }
  if (
    bytes.length >= 12 &&
    bytes.toString("ascii", 0, 4) === "RIFF" &&
    bytes.toString("ascii", 8, 12) === "WEBP"
  ) {
    return MIME_BY_SIGNATURE.webp;
  }
  return null;
}

function readDimensions(bytes: Buffer, mime: string): { width: number; height: number } | null {
  if (mime === "image/png" && bytes.length >= 24) {
    return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
  }
  if (mime === "image/webp" && bytes.length >= 30) {
    const chunk = bytes.toString("ascii", 12, 16);
    if (chunk === "VP8X") {
      return {
        width: 1 + bytes.readUIntLE(24, 3),
        height: 1 + bytes.readUIntLE(27, 3),
      };
    }
  }
  if (mime === "image/jpeg") {
    let offset = 2;
    while (offset + 4 < bytes.length) {
      if (bytes[offset] !== 0xff) {
        offset += 1;
        continue;
      }
      const marker = bytes[offset + 1];
      offset += 2;
      if (marker === 0xd8 || marker === 0xd9 || (marker >= 0xd0 && marker <= 0xd7)) continue;
      if (offset + 2 > bytes.length) return null;
      const segmentLength = bytes.readUInt16BE(offset);
      if (segmentLength < 2 || offset + segmentLength > bytes.length) return null;
      const isStartOfFrame = [0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker);
      if (isStartOfFrame && segmentLength >= 7) {
        return { height: bytes.readUInt16BE(offset + 3), width: bytes.readUInt16BE(offset + 5) };
      }
      offset += segmentLength;
    }
  }
  return null;
}

function validOptionalNumber(value: unknown, min: number, max: number): boolean {
  if (value === undefined || value === null || value === "") return true;
  const n = Number(value);
  return Number.isFinite(n) && n >= min && n <= max;
}

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const image = form.get("image");
    if (!(image instanceof File)) {
      return NextResponse.json({ error: "Please take or upload a soil image first." }, { status: 400 });
    }
    if (image.size === 0 || image.size > MAX_BYTES) {
      return NextResponse.json({ error: "Image must be non-empty and no larger than 5 MB." }, { status: 413 });
    }
    const bytes = Buffer.from(await image.arrayBuffer());
    const detectedMime = detectImageType(bytes);
    if (!detectedMime || detectedMime !== image.type) {
      return NextResponse.json(
        { error: "The file content does not match a supported JPG, PNG, or WebP image. Please choose a valid image." },
        { status: 415 },
      );
    }
    const dimensions = readDimensions(bytes, detectedMime);
    if (dimensions && (
      dimensions.width < 16 || dimensions.height < 16 ||
      dimensions.width > MAX_DIMENSION || dimensions.height > MAX_DIMENSION
    )) {
      return NextResponse.json({ error: "Image dimensions are outside the supported range (16–20,000 pixels per side)." }, { status: 400 });
    }

    const area = String(form.get("area") || "Unspecified").slice(0, 100);
    const district = String(form.get("district") || "").slice(0, 100);
    const crop = String(form.get("crop") || "").slice(0, 100);
    const season = String(form.get("season") || "").slice(0, 60);
    const irrigation = String(form.get("irrigation") || "").slice(0, 60);
    const rawMeasurements = String(form.get("measurements") || "{}").slice(0, 2000);
    let measurements: Record<string, unknown> = {};
    try {
      const parsed: unknown = JSON.parse(rawMeasurements);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        measurements = parsed as Record<string, unknown>;
      }
    } catch {
      return NextResponse.json({ error: "Measurement details are not valid JSON." }, { status: 400 });
    }
    if (
      !validOptionalNumber(measurements.moisture, 0, 100) ||
      !validOptionalNumber(measurements.ph, 0, 14)
    ) {
      return NextResponse.json({ error: "Enter moisture from 0–100% and pH from 0–14, using values from a sensor or lab report." }, { status: 400 });
    }

    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      return NextResponse.json({
        status: "AI provider not configured",
        error: "GEMINI_API_KEY is missing from the server environment. In Vercel, open Project Settings → Environment Variables, add GEMINI_API_KEY with your private Gemini API key for Production (and Preview if needed), save, then redeploy. Do not put the key in frontend code or GitHub. No analysis was generated.",
      }, { status: 503 });
    }

    const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
    const prompt = `You are SoilSense AI, a cautious soil-image observation assistant.
User-selected region: ${area}. District/nearby area: ${district || "not provided"}.
Crop of interest: ${crop || "not specified"}. Season: ${season || "not specified"}. Irrigation: ${irrigation || "not specified"}.
User-entered measurements (provided by the user, not independently verified): ${JSON.stringify(measurements)}.

Return a useful, structured response with these headings:
1. Visible observations: describe only what is actually visible (colour, apparent surface texture, stones, organic matter, or moisture-like appearance if evident).
2. Tentative visual interpretation: state that this is not a validated formal soil classification; include uncertainty in plain language and do not fabricate a confidence score.
3. Measurements supplied: repeat only the user-entered values and label them user-provided. Do not invent missing measurements.
4. What cannot be known from this photo: explicitly explain that a normal RGB image cannot measure pH, moisture percentage, N-P-K, mineral/nutrient content, salinity, CEC, or contamination.
5. Practical next steps: recommend appropriate soil testing and safe general steps. If crop context was supplied, make only cautious, general suggestions and state that local soil-test-based advice is needed before fertilizer decisions.

Area information is context only; never infer the exact chemistry of this sample from its location. Do not claim to have retrieved external sources or official data unless you actually did so. Do not prescribe specific fertilizer doses from a photo. Keep the response concise, understandable, and evidence-aware.`;

    const endpoint = "https://generativelanguage.googleapis.com/v1beta/models/" +
      encodeURIComponent(model) + ":generateContent?key=" + encodeURIComponent(key);
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: detectedMime, data: bytes.toString("base64") } }] }],
        generationConfig: { maxOutputTokens: 900, thinkingConfig: { thinkingLevel: "low" } },
      }),
      signal: AbortSignal.timeout(25_000),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      const providerMessage = typeof data?.error?.message === "string" ? data.error.message.slice(0, 240) : "";
      return NextResponse.json({
        error: "Gemini rejected the analysis request. Check the server-side GEMINI_API_KEY, quota/billing access, and GEMINI_MODEL setting." + (providerMessage ? " Provider detail: " + providerMessage : ""),
      }, { status: 502 });
    }
    const analysis = data?.candidates?.[0]?.content?.parts
      ?.map((part: { text?: string }) => part.text || "")
      .join("\n").trim();
    if (!analysis) {
      return NextResponse.json({ error: "The AI provider returned no usable analysis. Please try again." }, { status: 502 });
    }
    return NextResponse.json({
      status: "AI visual observations · not a laboratory test",
      source: model,
      analysis,
      limitations: ["Visual interpretation only", "No image-derived pH/moisture/NPK values", "Verify agronomic decisions with soil tests"],
    });
  } catch (error) {
    const isTimeout = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
    return NextResponse.json({
      error: isTimeout ? "AI analysis timed out. Please try again." : "The analysis service failed. Check provider configuration and try again.",
    }, { status: 502 });
  }
}
