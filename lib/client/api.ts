import { AnalysisResultSchema, HistoryRecordSchema, type AnalysisResult, type HistoryRecord } from "../schema";

/** Optional absolute API origin for split deployments; empty means same origin. */
export const API_BASE = (process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(/\/+$/, "");

export interface HealthInfo {
  status: string;
  provider: { name: string; model: string; configured: boolean; isMock: boolean; message: string };
  analysisAvailable: boolean;
  historyStorage: "browser" | "file";
  limits: { maxUploadBytes: number; acceptedTypes: string[] };
}

export class ApiError extends Error {
  constructor(message: string, readonly status: number, readonly code?: string) {
    super(message);
    this.name = "ApiError";
  }
}

async function readError(res: Response): Promise<ApiError> {
  let message = `Request failed (HTTP ${res.status}).`;
  let code: string | undefined;
  try {
    const body = await res.json();
    if (typeof body?.error === "string") message = body.error;
    if (typeof body?.code === "string") code = body.code;
  } catch {
    // keep generic message
  }
  return new ApiError(message, res.status, code);
}

async function request(path: string, init?: RequestInit, timeoutMs = 20_000): Promise<Response> {
  try {
    return await fetch(`${API_BASE}${path}`, { ...init, signal: init?.signal ?? AbortSignal.timeout(timeoutMs) });
  } catch (error) {
    if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) {
      throw new ApiError("The request timed out. Please check your connection and try again.", 0, "timeout");
    }
    throw new ApiError("Could not reach the SoilClass AI server. Check your connection and try again.", 0, "network");
  }
}

export async function fetchHealth(): Promise<HealthInfo> {
  const res = await request("/api/health", { cache: "no-store" });
  if (!res.ok) throw await readError(res);
  return res.json();
}

export async function analyzeSoil(image: Blob, fileName: string, city: string): Promise<AnalysisResult> {
  const form = new FormData();
  form.append("image", image, fileName);
  form.append("city", city);
  const res = await request("/api/analyze", { method: "POST", body: form }, 90_000);
  if (!res.ok) throw await readError(res);
  const parsed = AnalysisResultSchema.safeParse(await res.json());
  if (!parsed.success) throw new ApiError("The server returned an unexpected analysis format.", 502, "invalid_response");
  return parsed.data;
}

export type HistorySummary = Omit<HistoryRecord, "result">;

export interface HistoryBackend {
  readonly kind: "browser" | "file";
  list(): Promise<HistorySummary[]>;
  get(id: string): Promise<HistoryRecord | null>;
  add(record: HistoryRecord): Promise<void>;
  clear(): Promise<void>;
}

const LOCAL_KEY = "soilclass.history.v1";
const LOCAL_MAX = 30;

function readLocal(): HistoryRecord[] {
  try {
    const data = JSON.parse(window.localStorage.getItem(LOCAL_KEY) || "[]");
    if (!Array.isArray(data)) return [];
    return data.flatMap(item => {
      const parsed = HistoryRecordSchema.safeParse(item);
      return parsed.success ? [parsed.data] : [];
    });
  } catch {
    return [];
  }
}

function writeLocal(records: HistoryRecord[]): void {
  let toSave = records.slice(0, LOCAL_MAX);
  // Drop oldest entries if the browser storage quota is exceeded.
  while (toSave.length) {
    try {
      window.localStorage.setItem(LOCAL_KEY, JSON.stringify(toSave));
      return;
    } catch {
      toSave = toSave.slice(0, -1);
    }
  }
  window.localStorage.removeItem(LOCAL_KEY);
}

const stripResult = ({ result: _result, ...summary }: HistoryRecord): HistorySummary => summary;

export const browserHistory: HistoryBackend = {
  kind: "browser",
  async list() {
    return readLocal().sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(stripResult);
  },
  async get(id) {
    return readLocal().find(r => r.id === id) ?? null;
  },
  async add(record) {
    writeLocal([record, ...readLocal().filter(r => r.id !== record.id)]);
  },
  async clear() {
    window.localStorage.removeItem(LOCAL_KEY);
  },
};

export const serverHistory: HistoryBackend = {
  kind: "file",
  async list() {
    const res = await request("/api/history", { cache: "no-store" });
    if (!res.ok) throw await readError(res);
    return (await res.json()).items as HistorySummary[];
  },
  async get(id) {
    const res = await request(`/api/history/${encodeURIComponent(id)}`, { cache: "no-store" });
    if (res.status === 404) return null;
    if (!res.ok) throw await readError(res);
    const parsed = HistoryRecordSchema.safeParse((await res.json()).item);
    return parsed.success ? parsed.data : null;
  },
  async add(record) {
    const res = await request("/api/history", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(record),
    });
    if (!res.ok) throw await readError(res);
  },
  async clear() {
    const res = await request("/api/history", { method: "DELETE" });
    if (!res.ok) throw await readError(res);
  },
};

let backendPromise: Promise<HistoryBackend> | null = null;
export function getHistoryBackend(): Promise<HistoryBackend> {
  backendPromise ??= fetchHealth()
    .then(h => (h.historyStorage === "file" ? serverHistory : browserHistory))
    .catch(() => browserHistory);
  return backendPromise;
}

export function toHistoryRecord(result: AnalysisResult, thumbnail: string | null): HistoryRecord {
  return {
    id: result.id,
    createdAt: result.createdAt,
    city: result.city,
    category: result.classification.category,
    confidence: result.classification.confidence,
    summary: result.summary,
    thumbnail,
    result,
  };
}
