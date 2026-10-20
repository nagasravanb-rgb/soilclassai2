import type { ValidatedImage } from "../image";

export interface AnalyzeSoilImageInput {
  image: ValidatedImage;
  city: string;
  timeoutMs: number;
}

/** Common interface every AI provider adapter implements. */
export interface SoilAnalysisProvider {
  readonly name: string;
  readonly model: string;
  readonly isMock: boolean;
  /** Calls the provider and returns its raw (unvalidated) structured output. */
  analyzeSoilImage(input: AnalyzeSoilImageInput): Promise<unknown>;
}

export type ProviderErrorCode =
  | "not_configured"
  | "unsupported_provider"
  | "timeout"
  | "rate_limited"
  | "upstream_error"
  | "invalid_response"
  | "blocked";

const STATUS: Record<ProviderErrorCode, number> = {
  not_configured: 503,
  unsupported_provider: 503,
  timeout: 504,
  rate_limited: 429,
  upstream_error: 502,
  invalid_response: 502,
  blocked: 422,
};

/** Errors whose `message` is safe to show to end users (no secrets or stack traces). */
export class ProviderError extends Error {
  readonly status: number;
  constructor(readonly code: ProviderErrorCode, message: string) {
    super(message);
    this.name = "ProviderError";
    this.status = STATUS[code];
  }
}
