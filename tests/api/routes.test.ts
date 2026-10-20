import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST as analyze } from "@/app/api/analyze/route";
import { GET as health } from "@/app/api/health/route";
import { resetRateLimits } from "@/lib/rateLimit";
import { DELETE as clearHistory, GET as listHistory, POST as addHistory } from "@/app/api/history/route";
import { GET as getHistory } from "@/app/api/history/[id]/route";
import { analyzeRequest, makePng, pngBlob } from "../helpers";

const ENV_KEYS = ["AI_PROVIDER", "AI_API_KEY", "AI_MODEL", "GEMINI_API_KEY", "GEMINI_MODEL", "HISTORY_STORAGE", "HISTORY_FILE_PATH", "MAX_UPLOAD_MB", "AI_TIMEOUT_MS", "HISTORY_ACCESS_TOKEN", "ANALYZE_RATE_LIMIT_PER_MIN"];
let saved: Record<string, string | undefined>;
beforeEach(() => {
  saved = Object.fromEntries(ENV_KEYS.map(k => [k, process.env[k]]));
  ENV_KEYS.forEach(k => delete process.env[k]);
  resetRateLimits();
});
afterEach(() => {
  ENV_KEYS.forEach(k => { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; });
  vi.unstubAllGlobals();
});

describe("GET /api/health", () => {
  it("reports status without exposing secrets", async () => {
    process.env.AI_PROVIDER = "gemini";
    process.env.AI_API_KEY = "super-secret-value";
    const res = await health();
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).not.toContain("super-secret-value");
    const body = JSON.parse(text);
    expect(body).toMatchObject({ status: "ok", analysisAvailable: true, historyStorage: "browser", provider: { name: "gemini", configured: true } });
  });

  it("reports missing credentials", async () => {
    const body = await (await health()).json();
    expect(body.analysisAvailable).toBe(false);
    expect(body.provider.message).toMatch(/AI_API_KEY/);
  });
});

describe("POST /api/analyze", () => {
  beforeEach(() => { process.env.AI_PROVIDER = "mock"; });

  it("returns 400 when the city is missing", async () => {
    const res = await analyze(analyzeRequest({ image: pngBlob() }));
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ code: "invalid_city" });
  });

  it("returns 400 when the image is missing", async () => {
    const res = await analyze(analyzeRequest({ city: "Pune" }));
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ code: "missing_image" });
  });

  it("returns 400 for non-multipart requests", async () => {
    const res = await analyze(new Request("http://localhost/api/analyze", { method: "POST", body: "{}", headers: { "content-type": "application/json" } }));
    expect(res.status).toBe(400);
  });

  it("returns 415 for a non-image file even with an image MIME type", async () => {
    const res = await analyze(analyzeRequest({ city: "Pune", image: new Blob(["<?php echo 1; ?>"], { type: "image/png" }), fileName: "x.png" }));
    expect(res.status).toBe(415);
    expect(await res.json()).toMatchObject({ code: "invalid_image" });
  });

  it("returns 400 for a corrupted image", async () => {
    const bytes = makePng().subarray(0, 12);
    const res = await analyze(analyzeRequest({ city: "Pune", image: new Blob([new Uint8Array(bytes)], { type: "image/png" }) }));
    expect(res.status).toBe(400);
  });

  it("rate-limits analysis requests per client", async () => {
    process.env.ANALYZE_RATE_LIMIT_PER_MIN = "2";
    const make = () => { const r = analyzeRequest({ city: "Pune", image: pngBlob() }); r.headers.set("x-forwarded-for", "203.0.113.9"); return r; };
    expect((await analyze(make())).status).toBe(200);
    expect((await analyze(make())).status).toBe(200);
    const limited = await analyze(make());
    expect(limited.status).toBe(429);
    expect(limited.headers.get("Retry-After")).toBeTruthy();
    expect(await limited.json()).toMatchObject({ code: "too_many_requests" });
  });

  it("returns 413 for an oversized multipart body without Content-Length", async () => {
    process.env.MAX_UPLOAD_MB = "1";
    const big = new ReadableStream({ start(c) { c.enqueue(new Uint8Array(2 * 1024 * 1024)); c.close(); } });
    const res = await analyze(new Request("http://localhost/api/analyze", { method: "POST", body: big, headers: { "content-type": "multipart/form-data; boundary=x" }, duplex: "half" } as RequestInit));
    expect(res.status).toBe(413);
  });

  it("returns 413 for an oversized image", async () => {
    process.env.MAX_UPLOAD_MB = "1";
    const big = new Uint8Array(1024 * 1024 + 10);
    big.set(makePng());
    const res = await analyze(analyzeRequest({ city: "Pune", image: new Blob([big], { type: "image/png" }) }));
    expect(res.status).toBe(413);
  });

  it("returns a structured mock analysis", async () => {
    const res = await analyze(analyzeRequest({ city: "Pune", image: pngBlob() }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.city).toBe("Pune");
    expect(body.provider).toEqual({ name: "mock", model: "mock-fixture-v1", isMock: true });
    expect(body.classification.source).toBe("ai_prediction");
    expect(body.nutrients.length).toBeGreaterThan(0);
  });

  it("returns 503 with a safe message when AI credentials are missing", async () => {
    process.env.AI_PROVIDER = "gemini";
    const res = await analyze(analyzeRequest({ city: "Pune", image: pngBlob() }));
    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({ code: "not_configured" });
  });

  it("returns 504 when the provider times out", async () => {
    process.env.AI_PROVIDER = "gemini";
    process.env.AI_API_KEY = "test-key";
    process.env.AI_TIMEOUT_MS = "1000";
    vi.stubGlobal("fetch", vi.fn((_u: string, init?: RequestInit) => new Promise((_r, reject) => init?.signal?.addEventListener("abort", () => reject(init.signal?.reason)))));
    const res = await analyze(analyzeRequest({ city: "Pune", image: pngBlob() }));
    expect(res.status).toBe(504);
    expect(await res.json()).toMatchObject({ code: "timeout" });
  });

  it("returns 502 when the provider response is malformed", async () => {
    process.env.AI_PROVIDER = "gemini";
    process.env.AI_API_KEY = "test-key";
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: '{"summary":"incomplete"}' }] } }] }), { status: 200 })));
    const res = await analyze(analyzeRequest({ city: "Pune", image: pngBlob() }));
    expect(res.status).toBe(502);
    const text = await res.text();
    expect(text).toContain("invalid_response");
    expect(text).not.toContain("test-key");
    expect(text).not.toMatch(/at \w+ \(/);
  });
});

describe("history endpoints", () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), "soilclass-api-"));
    process.env.AI_PROVIDER = "mock";
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  const TOKEN = "test-history-token-123";
  const auth = { Authorization: `Bearer ${TOKEN}` };
  const req = (init?: RequestInit) => new Request("http://localhost/api/history", { ...init, headers: { ...auth, ...(init?.headers as Record<string, string>) } });
  const fileMode = () => {
    process.env.HISTORY_STORAGE = "file";
    process.env.HISTORY_FILE_PATH = path.join(dir, "h.json");
    process.env.HISTORY_ACCESS_TOKEN = TOKEN;
  };

  it("requires a configured access token and a matching bearer token", async () => {
    process.env.HISTORY_STORAGE = "file";
    process.env.HISTORY_FILE_PATH = path.join(dir, "h.json");
    expect((await listHistory(req())).status).toBe(503);
    process.env.HISTORY_ACCESS_TOKEN = TOKEN;
    expect((await listHistory(new Request("http://localhost/api/history"))).status).toBe(401);
    expect((await clearHistory(new Request("http://localhost/api/history", { method: "DELETE", headers: { Authorization: "Bearer wrong" } }))).status).toBe(401);
    expect((await getHistory(new Request("http://localhost"), { params: Promise.resolve({ id: "00000000-0000-4000-8000-000000000000" }) })).status).toBe(401);
    expect((await listHistory(req())).status).toBe(200);
  });

  it("rejects oversized history bodies without Content-Length", async () => {
    fileMode();
    const big = new ReadableStream({ start(c) { c.enqueue(new Uint8Array(500 * 1024)); c.close(); } });
    const res = await addHistory(new Request("http://localhost/api/history", { method: "POST", body: big, headers: auth, duplex: "half" } as RequestInit));
    expect(res.status).toBe(413);
  });

  it("returns 501 when server-side history is disabled", async () => {
    const res = await listHistory(req());
    expect(res.status).toBe(501);
    expect(await res.json()).toMatchObject({ code: "history_browser_only" });
  });

  it("persists, lists, fetches and clears records in file mode", async () => {
    fileMode();
    const result = await (await analyze(analyzeRequest({ city: "Nairobi", image: pngBlob() }))).json();
    const record = { id: result.id, createdAt: result.createdAt, city: result.city, category: result.classification.category, confidence: result.classification.confidence, summary: result.summary, thumbnail: null, result };

    const post = await addHistory(req({ method: "POST", body: JSON.stringify(record) }));
    expect(post.status).toBe(201);

    const list = await (await listHistory(req())).json();
    expect(list.items).toHaveLength(1);
    expect(list.items[0]).toMatchObject({ id: result.id, city: "Nairobi" });
    expect(list.items[0].result).toBeUndefined();

    const one = await getHistory(req(), { params: Promise.resolve({ id: result.id }) });
    expect(one.status).toBe(200);
    expect((await one.json()).item.result.id).toBe(result.id);

    const missing = await getHistory(req(), { params: Promise.resolve({ id: "00000000-0000-4000-8000-000000000000" }) });
    expect(missing.status).toBe(404);
    const invalid = await getHistory(req(), { params: Promise.resolve({ id: "../etc" }) });
    expect(invalid.status).toBe(400);

    expect(await (await clearHistory(req({ method: "DELETE" }))).json()).toMatchObject({ deleted: 1 });
    expect((await (await listHistory(req())).json()).items).toHaveLength(0);
  });

  it("rejects invalid history records", async () => {
    fileMode();
    const bad = await addHistory(req({ method: "POST", body: JSON.stringify({ id: "x" }) }));
    expect(bad.status).toBe(400);
    const notJson = await addHistory(req({ method: "POST", body: "nope" }));
    expect(notJson.status).toBe(400);
  });
});
