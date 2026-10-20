import { randomUUID } from "crypto";
import type { ServerConfig } from "./config";
import { validateImageBytes } from "./image";
import { normalizeAnalysisResult } from "./normalize";
import { getProvider, ProviderError, type SoilAnalysisProvider } from "./providers";
import { validateProviderResponse } from "./providers/validate";
import type { AnalysisResult } from "./schema";

export interface RunAnalysisInput {
  imageBytes: Uint8Array;
  city: string;
  config: ServerConfig;
  provider?: SoilAnalysisProvider;
}

/** Full pipeline: validate image → call provider → validate response → normalize. */
export async function runSoilAnalysis({ imageBytes, city, config, provider }: RunAnalysisInput): Promise<AnalysisResult> {
  const image = validateImageBytes(imageBytes, config.maxUploadBytes);
  const activeProvider = provider ?? getProvider(config);
  const raw = await activeProvider.analyzeSoilImage({ image, city, timeoutMs: config.timeoutMs });
  const validated = validateProviderResponse(raw);
  if (!validated.imageAssessment.isSoil) {
    throw new ProviderError("blocked", "This photo does not appear to show soil. Please take or upload a clear, close-up photo of the soil surface.");
  }
  return normalizeAnalysisResult(validated, {
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    city,
    provider: { name: activeProvider.name, model: activeProvider.model, isMock: activeProvider.isMock },
  });
}
