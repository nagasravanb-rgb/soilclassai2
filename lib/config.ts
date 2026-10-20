export type HistoryStorageMode = "browser" | "file";

export interface ServerConfig {
  provider: string;
  apiKey: string | undefined;
  model: string;
  timeoutMs: number;
  maxUploadBytes: number;
  historyStorage: HistoryStorageMode;
  historyFilePath: string;
  historyAccessToken: string | undefined;
  analyzeRateLimitPerMin: number;
}

export const DEFAULT_GEMINI_MODEL = "gemini-3.8-flash";

function positiveInt(value: string | undefined, fallback: number, min: number, max: number): number {
  const n = Number(value);
  if (!value || !Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

/** Reads server-only configuration. Never import this from client components. */
export function getServerConfig(env: Record<string, string | undefined> = process.env): ServerConfig {
  const provider = (env.AI_PROVIDER || "gemini").trim().toLowerCase();
  const apiKey = (env.AI_API_KEY || env.GEMINI_API_KEY || "").trim() || undefined;
  const defaultModel = provider === "gemini" ? DEFAULT_GEMINI_MODEL : provider;
  const model = (env.AI_MODEL || env.GEMINI_MODEL || "").trim() || defaultModel;
  const historyStorage: HistoryStorageMode = env.HISTORY_STORAGE?.trim().toLowerCase() === "file" ? "file" : "browser";
  return {
    provider,
    apiKey,
    model,
    timeoutMs: positiveInt(env.AI_TIMEOUT_MS, 25_000, 1_000, 120_000),
    maxUploadBytes: positiveInt(env.MAX_UPLOAD_MB, 4, 1, 20) * 1024 * 1024,
    historyStorage,
    historyFilePath: env.HISTORY_FILE_PATH?.trim() || ".data/history.json",
    historyAccessToken: env.HISTORY_ACCESS_TOKEN?.trim() || undefined,
    analyzeRateLimitPerMin: env.ANALYZE_RATE_LIMIT_PER_MIN?.trim() === "0" ? 0 : positiveInt(env.ANALYZE_RATE_LIMIT_PER_MIN, 10, 1, 10_000),
  };
}
