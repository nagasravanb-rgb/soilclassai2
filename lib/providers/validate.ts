import { ProviderResponseSchema, type ProviderResponse } from "../schema";
import { ProviderError } from "./types";

function parseJsonText(raw: string): unknown {
  const trimmed = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try {
    return JSON.parse(trimmed);
  } catch {
    throw new ProviderError("invalid_response", "The AI provider returned a response that was not valid JSON. Please try again.");
  }
}

/** Validates raw provider output (object or JSON text) against the expected schema. */
export function validateProviderResponse(raw: unknown): ProviderResponse {
  const value = typeof raw === "string" ? parseJsonText(raw) : raw;
  const parsed = ProviderResponseSchema.safeParse(value);
  if (!parsed.success) {
    throw new ProviderError(
      "invalid_response",
      "The AI provider returned an incomplete or malformed analysis. No result was produced. Please try again.",
    );
  }
  return parsed.data;
}
