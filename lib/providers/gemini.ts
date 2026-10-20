import { buildSoilPrompt, GEMINI_RESPONSE_SCHEMA } from "./prompt";
import { ProviderError, type AnalyzeSoilImageInput, type SoilAnalysisProvider } from "./types";

const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models/";

function toBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength).toString("base64");
}

function isAbort(error: unknown): boolean {
  return error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
}

export class GeminiProvider implements SoilAnalysisProvider {
  readonly name = "gemini";
  readonly isMock = false;

  constructor(private readonly apiKey: string, readonly model: string, private readonly fetchImpl: typeof fetch = fetch) {}

  async analyzeSoilImage({ image, city, timeoutMs }: AnalyzeSoilImageInput): Promise<unknown> {
    let response: Response;
    try {
      response = await this.fetchImpl(`${API_BASE}${encodeURIComponent(this.model)}:generateContent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": this.apiKey },
        body: JSON.stringify({
          contents: [{
            role: "user",
            parts: [{ text: buildSoilPrompt(city) }, { inline_data: { mime_type: image.mime, data: toBase64(image.bytes) } }],
          }],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 4096,
            responseMimeType: "application/json",
            responseSchema: GEMINI_RESPONSE_SCHEMA,
          },
        }),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (error) {
      if (isAbort(error)) throw new ProviderError("timeout", "The AI provider did not respond in time. Please try again.");
      throw new ProviderError("upstream_error", "Could not reach the AI provider. Check the server's network connection.");
    }

    let data: unknown;
    try {
      data = await response.json();
    } catch (error) {
      if (isAbort(error)) throw new ProviderError("timeout", "The AI provider did not respond in time. Please try again.");
      throw new ProviderError("invalid_response", "The AI provider returned an unreadable response.");
    }

    if (!response.ok) {
      if (response.status === 429) {
        throw new ProviderError("rate_limited", "The AI provider's quota or rate limit was reached. Please wait and try again, or check your plan.");
      }
      if (response.status === 400 || response.status === 401 || response.status === 403) {
        throw new ProviderError("upstream_error", "The AI provider rejected the request. Check the server-side API key, model name, and account access.");
      }
      if (response.status === 404) {
        throw new ProviderError("upstream_error", "The configured AI model was not found. Check the AI_MODEL setting.");
      }
      throw new ProviderError("upstream_error", "The AI provider returned an error. Please try again later.");
    }

    const body = data as {
      promptFeedback?: { blockReason?: string };
      candidates?: Array<{ finishReason?: string; content?: { parts?: Array<{ text?: string }> } }>;
    };
    if (body?.promptFeedback?.blockReason) {
      throw new ProviderError("blocked", "The AI provider declined to analyse this image. Please try a different photo.");
    }
    const candidate = body?.candidates?.[0];
    const text = candidate?.content?.parts?.map(part => part.text ?? "").join("").trim();
    if (!text) {
      if (candidate?.finishReason === "SAFETY") {
        throw new ProviderError("blocked", "The AI provider declined to analyse this image. Please try a different photo.");
      }
      throw new ProviderError("invalid_response", "The AI provider returned an empty analysis. Please try again.");
    }
    return text;
  }
}
