import { AnalysisResultSchema, HistoryRecordSchema, type AnalysisResult, type HistoryRecord } from "../schema";

/** Optional absolute API origin for split deployments; empty means same origin. */
export const API_BASE = (process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(/\/+$/, "");

export interface HealthInfo {
  status: string;
  provider: { name: string; model: string; configured: boolean; isMock: boolean; message: string };
  analysisAvailable: boolean;
  historyStorage: "browser" | "file";
  historyAuthRequired?: boolean;
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

const TOKEN_KEY = "soilclass.historyToken.v1";

export function getHistoryToken(): string {
  try { return window.localStorage.getItem(TOKEN_KEY) || ""; } catch { return ""; }
}

export function setHistoryToken(token: string): void {
  if (token) window.localStorage.setItem(TOKEN_KEY, token);
  else window.localStorage.removeItem(TOKEN_KEY);
}

function historyHeaders(extra?: Record<string, string>): Record<string, string> {
  const token = getHistoryToken();
  return { ...extra, ...(token ? { Authorization: `Bearer ${token}` } : {}) };
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

export interface AddOutcome {
  /** Older browser entries removed to make room for the new record. */
  droppedOlder: number;
  /** The thumbnail was left out because browser storage was full. */
  thumbnailDropped: boolean;
}

export interface HistoryBackend {
  readonly kind: "browser" | "file";
  list(): Promise<HistorySummary[]>;
  get(id: string): Promise<HistoryRecord | null>;
  add(record: HistoryRecord): Promise<AddOutcome>;
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

export class HistoryQuotaError extends Error {
  constructor() {
    super("Browser storage is full, so this result was not saved. Your existing history was kept. Clear some history in Settings to save new analyses.");
    this.name = "HistoryQuotaError";
  }
}

function trySet(records: HistoryRecord[]): boolean {
  try {
    window.localStorage.setItem(LOCAL_KEY, JSON.stringify(records));
    return true;
  } catch {
    return false;
  }
}

/**
 * Saves `record` ahead of `existing`. The stored value is only replaced by a successful write:
 * first with everything, then without the new thumbnail, then dropping the oldest entries.
 * Throws HistoryQuotaError (leaving storage untouched) if the new record cannot fit at all.
 */
export function writeLocal(record: HistoryRecord, existing: HistoryRecord[]): AddOutcome {
  const valid = HistoryRecordSchema.parse(record);
  const older = existing.filter(r => r.id !== valid.id).slice(0, LOCAL_MAX - 1);
  if (trySet([valid, ...older])) return { droppedOlder: 0, thumbnailDropped: false };
  const slim = { ...valid, thumbnail: null };
  const thumbnailDropped = valid.thumbnail !== null;
  for (let keep = older.length; keep >= 0; keep--) {
    if (trySet([slim, ...older.slice(0, keep)])) return { droppedOlder: older.length - keep, thumbnailDropped };
  }
  throw new HistoryQuotaError();
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
    return writeLocal(record, readLocal());
  },
  async clear() {
    window.localStorage.removeItem(LOCAL_KEY);
  },
};

export const serverHistory: HistoryBackend = {
  kind: "file",
  async list() {
    const res = await request("/api/history", { cache: "no-store", headers: historyHeaders() });
    if (!res.ok) throw await readError(res);
    return (await res.json()).items as HistorySummary[];
  },
  async get(id) {
    const res = await request(`/api/history/${encodeURIComponent(id)}`, { cache: "no-store", headers: historyHeaders() });
    if (res.status === 404) return null;
    if (!res.ok) throw await readError(res);
    const parsed = HistoryRecordSchema.safeParse((await res.json()).item);
    return parsed.success ? parsed.data : null;
  },
  async add(record) {
    const res = await request("/api/history", {
      method: "POST",
      headers: historyHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(record),
    });
    if (!res.ok) throw await readError(res);
    return { droppedOlder: 0, thumbnailDropped: false };
  },
  async clear() {
    const res = await request("/api/history", { method: "DELETE", headers: historyHeaders() });
    if (!res.ok) throw await readError(res);
  },
};

const MODE_KEY = "soilclass.historyMode.v1";
let backendPromise: Promise<HistoryBackend> | null = null;

/**
 * Picks browser or server history from /api/health. Only a confirmed answer is cached; if the
 * health check fails, the last confirmed mode is reused (uncached) or the error is surfaced.
 */
export function getHistoryBackend(): Promise<HistoryBackend> {
  backendPromise ??= fetchHealth()
    .then(h => {
      try { window.localStorage.setItem(MODE_KEY, h.historyStorage); } catch { /* storage unavailable */ }
      return h.historyStorage === "file" ? serverHistory : browserHistory;
    })
    .catch(error => {
      backendPromise = null;
      let last: string | null = null;
      try { last = window.localStorage.getItem(MODE_KEY); } catch { /* storage unavailable */ }
      if (last === "browser") return browserHistory;
      throw error;
    });
  return backendPromise;
}

export function resetHistoryBackendCache(): void {
  backendPromise = null;
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
