import type { ServerConfig } from "../config";
import { GeminiProvider } from "./gemini";
import { MockProvider } from "./mock";
import { ProviderError, type SoilAnalysisProvider } from "./types";

export const SUPPORTED_PROVIDERS = ["gemini", "mock"] as const;

export interface ProviderStatus {
  name: string;
  model: string;
  configured: boolean;
  isMock: boolean;
  message: string;
}

export function getProviderStatus(config: ServerConfig): ProviderStatus {
  if (config.provider === "mock") {
    return { name: "mock", model: "mock-fixture-v1", configured: true, isMock: true, message: "Mock provider active — results are demo fixtures, not real AI analysis." };
  }
  if (config.provider === "gemini") {
    return config.apiKey
      ? { name: "gemini", model: config.model, configured: true, isMock: false, message: "Google Gemini vision provider configured." }
      : { name: "gemini", model: config.model, configured: false, isMock: false, message: "AI_API_KEY is not set on the server. Image analysis is unavailable until it is configured." };
  }
  return { name: config.provider, model: config.model, configured: false, isMock: false, message: `Unsupported AI_PROVIDER "${config.provider}". Supported: ${SUPPORTED_PROVIDERS.join(", ")}.` };
}

export function getProvider(config: ServerConfig): SoilAnalysisProvider {
  switch (config.provider) {
    case "mock":
      return new MockProvider(Number(process.env.MOCK_DELAY_MS) || 0);
    case "gemini":
      if (!config.apiKey) {
        throw new ProviderError("not_configured", "AI analysis is not configured on the server (missing AI_API_KEY). No analysis was performed.");
      }
      return new GeminiProvider(config.apiKey, config.model);
    default:
      throw new ProviderError("unsupported_provider", "The configured AI provider is not supported. No analysis was performed.");
  }
}

export { ProviderError } from "./types";
export type { SoilAnalysisProvider } from "./types";
