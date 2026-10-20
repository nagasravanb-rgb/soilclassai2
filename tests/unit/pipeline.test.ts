import { afterEach, describe, expect, it, vi } from "vitest";
import { runSoilAnalysis } from "@/lib/analysis";
import { getServerConfig } from "@/lib/config";
import { getProvider, getProviderStatus, ProviderError } from "@/lib/providers";
import { GeminiProvider } from "@/lib/providers/gemini";
import { MockProvider } from "@/lib/providers/mock";
import { validateProviderResponse } from "@/lib/providers/validate";
import { AnalysisResultSchema } from "@/lib/schema";
import { makePng } from "../helpers";

const baseConfig = () => getServerConfig({ AI_PROVIDER: "mock" });

async function mockRaw(): Promise<Record<string, unknown>> {
  return JSON.parse((await new MockProvider().analyzeSoilImage({} as never)) as string);
}

function geminiResponse(text: string) {
  return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }] }), { status: 200 });
}

afterEach(() => vi.useRealTimers());

describe("configuration and provider selection", () => {
  it("reads AI_* variables with GEMINI_* fallback", () => {
    expect(getServerConfig({ AI_PROVIDER: "gemini", AI_API_KEY: "k", AI_MODEL: "m" })).toMatchObject({ provider: "gemini", apiKey: "k", model: "m" });
    expect(getServerConfig({ GEMINI_API_KEY: "g" })).toMatchObject({ provider: "gemini", apiKey: "g" });
  });

  it("reports and throws a safe error when credentials are missing", () => {
    const config = getServerConfig({ AI_PROVIDER: "gemini" });
    expect(getProviderStatus(config).configured).toBe(false);
    expect(() => getProvider(config)).toThrowError(ProviderError);
    try { getProvider(config); } catch (e) { expect((e as ProviderError).status).toBe(503); }
  });

  it("rejects unsupported providers", () => {
    expect(() => getProvider(getServerConfig({ AI_PROVIDER: "foo" }))).toThrowError(/not supported/);
  });
});

describe("analysis pipeline", () => {
  it("produces a schema-valid, clearly-flagged mock result", async () => {
    const result = await runSoilAnalysis({ imageBytes: makePng(), city: "Pune", config: baseConfig() });
    expect(AnalysisResultSchema.parse(result)).toBeTruthy();
    expect(result.provider.isMock).toBe(true);
    expect(result.classification.category).toBe("loamy");
    expect(result.moisture.measuredPercent).toBeNull();
    expect(result.nutrients.every(n => n.value === null && n.source === "not_measured")).toBe(true);
    expect(result.recommendations.basis).toBe("general_guidance_without_measured_data");
  });

  it("strips fabricated measurements returned by the provider", async () => {
    const raw = await mockRaw();
    (raw.recommendations as Record<string, string[]>).soilManagement = ["Apply 40 kg/ha urea", "Add compost"];
    (raw.moisture as Record<string, string>).evidence = "Moisture content of 25%";
    raw.summary = "The pH is 6.2 and soil is loamy";
    const provider = { name: "fake", model: "x", isMock: false, analyzeSoilImage: async () => raw };
    const result = await runSoilAnalysis({ imageBytes: makePng(), city: "Pune", config: baseConfig(), provider });
    expect(result.recommendations.soilManagement).toEqual(["Add compost"]);
    expect(result.moisture.evidence).not.toMatch(/25%/);
    expect(result.summary).not.toMatch(/6\.2/);
    expect(result.removedClaims).toBe(3);
  });

  it("rejects non-soil images", async () => {
    const raw = await mockRaw();
    (raw.imageAssessment as Record<string, unknown>).isSoil = false;
    const provider = { name: "fake", model: "x", isMock: false, analyzeSoilImage: async () => raw };
    await expect(runSoilAnalysis({ imageBytes: makePng(), city: "Pune", config: baseConfig(), provider })).rejects.toMatchObject({ code: "blocked", status: 422 });
  });
});

describe("validateProviderResponse", () => {
  it("accepts JSON text wrapped in code fences", async () => {
    const raw = await mockRaw();
    expect(validateProviderResponse("```json\n" + JSON.stringify(raw) + "\n```").summary).toBeTruthy();
  });
  it.each([
    ["non-JSON text", "Sure! The soil is loamy."],
    ["missing fields", JSON.stringify({ summary: "x" })],
    ["out-of-range confidence", "CONF"],
    ["unknown category", "CAT"],
  ])("rejects %s", async (_label, input) => {
    let value: unknown = input;
    if (input === "CONF" || input === "CAT") {
      const raw = await mockRaw();
      const c = raw.classification as Record<string, unknown>;
      if (input === "CONF") c.confidence = 7; else c.category = "volcanic";
      value = raw;
    }
    expect(() => validateProviderResponse(value)).toThrowError(expect.objectContaining({ code: "invalid_response" }));
  });
});

describe("GeminiProvider", () => {
  const image = { bytes: makePng(), mime: "image/png" as const, width: 64, height: 64 };

  it("sends the key in a header (not the URL) and requests JSON output", async () => {
    const raw = await mockRaw();
    const fetchMock = vi.fn(async (_url: string | URL | Request, _init?: RequestInit) => geminiResponse(JSON.stringify(raw)));
    const provider = new GeminiProvider("secret-key", "test-model", fetchMock as unknown as typeof fetch);
    const text = await provider.analyzeSoilImage({ image, city: "Pune", timeoutMs: 5000 });
    expect(validateProviderResponse(text).classification.category).toBe("loamy");
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).not.toContain("secret-key");
    expect((init?.headers as Record<string, string>)["x-goog-api-key"]).toBe("secret-key");
    const body = JSON.parse(String(init?.body));
    expect(body.generationConfig.responseMimeType).toBe("application/json");
    expect(body.contents[0].parts[1].inline_data.mime_type).toBe("image/png");
  });

  it("maps a timeout to a 504 ProviderError", async () => {
    const fetchMock = vi.fn((_url: string, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(init.signal?.reason));
    }));
    const provider = new GeminiProvider("k", "m", fetchMock as unknown as typeof fetch);
    await expect(provider.analyzeSoilImage({ image, city: "Pune", timeoutMs: 1000 })).rejects.toMatchObject({ code: "timeout", status: 504 });
  });

  it("maps HTTP errors without leaking provider details", async () => {
    const mk = (status: number) => new GeminiProvider("k", "m", (async () => new Response(JSON.stringify({ error: { message: "API key AIza-secret invalid" } }), { status })) as unknown as typeof fetch);
    await expect(mk(429).analyzeSoilImage({ image, city: "x", timeoutMs: 1000 })).rejects.toMatchObject({ code: "rate_limited", status: 429 });
    const err = (await mk(403).analyzeSoilImage({ image, city: "x", timeoutMs: 1000 }).catch((e: unknown) => e)) as ProviderError;
    expect(err).toMatchObject({ code: "upstream_error", status: 502 });
    expect(err.message).not.toContain("AIza");
  });

  it("handles malformed and empty provider payloads", async () => {
    const bad = new GeminiProvider("k", "m", (async () => new Response("<html>oops</html>", { status: 200 })) as unknown as typeof fetch);
    await expect(bad.analyzeSoilImage({ image, city: "x", timeoutMs: 1000 })).rejects.toMatchObject({ code: "invalid_response" });
    const empty = new GeminiProvider("k", "m", (async () => new Response(JSON.stringify({ candidates: [] }), { status: 200 })) as unknown as typeof fetch);
    await expect(empty.analyzeSoilImage({ image, city: "x", timeoutMs: 1000 })).rejects.toMatchObject({ code: "invalid_response" });
    const blocked = new GeminiProvider("k", "m", (async () => new Response(JSON.stringify({ promptFeedback: { blockReason: "SAFETY" } }), { status: 200 })) as unknown as typeof fetch);
    await expect(blocked.analyzeSoilImage({ image, city: "x", timeoutMs: 1000 })).rejects.toMatchObject({ code: "blocked" });
    const garbled = new GeminiProvider("k", "m", (async () => geminiResponse("{not json")) as unknown as typeof fetch);
    const text = await garbled.analyzeSoilImage({ image, city: "x", timeoutMs: 1000 });
    expect(() => validateProviderResponse(text)).toThrowError(expect.objectContaining({ code: "invalid_response" }));
  });
});
