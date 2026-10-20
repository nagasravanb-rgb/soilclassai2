import { runSoilAnalysis } from "@/lib/analysis";
import { getServerConfig } from "@/lib/config";
import { BodyTooLargeError, errorJson, json, readBodyLimited } from "@/lib/http";
import { ImageValidationError } from "@/lib/image";
import { ProviderError } from "@/lib/providers";
import { checkRateLimit, clientKey } from "@/lib/rateLimit";
import { validateCity } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request) {
  const config = getServerConfig();

  const limit = checkRateLimit(clientKey(req), config.analyzeRateLimitPerMin);
  if (!limit.ok) {
    const res = errorJson("Too many analysis requests. Please wait a minute and try again.", 429, "too_many_requests");
    res.headers.set("Retry-After", String(limit.retryAfterSec));
    return res;
  }

  let form: FormData;
  try {
    const body = await readBodyLimited(req, config.maxUploadBytes + 64 * 1024);
    form = await new Response(body as BodyInit, { headers: { "content-type": req.headers.get("content-type") || "" } }).formData();
  } catch (error) {
    if (error instanceof BodyTooLargeError) {
      return errorJson(`Upload is larger than the ${Math.round(config.maxUploadBytes / 1024 / 1024)} MB limit.`, 413, "file_too_large");
    }
    return errorJson("Request must be multipart/form-data with an image and a city.", 400, "invalid_request");
  }

  const city = validateCity(form.get("city"));
  if (!city.ok) return errorJson(city.error, 400, "invalid_city");

  const image = form.get("image");
  if (!image || typeof image === "string") {
    return errorJson("Please take or upload a soil photo.", 400, "missing_image");
  }
  if (image.size > config.maxUploadBytes) {
    return errorJson(`Image is larger than the ${Math.round(config.maxUploadBytes / 1024 / 1024)} MB limit.`, 413, "file_too_large");
  }

  try {
    const bytes = new Uint8Array(await image.arrayBuffer());
    const result = await runSoilAnalysis({ imageBytes: bytes, city: city.city, config });
    return json(result);
  } catch (error) {
    if (error instanceof ImageValidationError) return errorJson(error.message, error.status, "invalid_image");
    if (error instanceof ProviderError) return errorJson(error.message, error.status, error.code);
    console.error("analyze: unexpected error", error instanceof Error ? error.name : "unknown");
    return errorJson("The analysis could not be completed due to an internal error. Please try again.", 500, "internal_error");
  }
}
