import { mkdtempSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runSoilAnalysis } from "@/lib/analysis";
import { getServerConfig } from "@/lib/config";
import { FileHistoryStore } from "@/lib/history/store";
import type { HistoryRecord } from "@/lib/schema";
import { makePng } from "../helpers";

let dir: string;
beforeEach(() => { dir = mkdtempSync(path.join(tmpdir(), "soilclass-")); });
afterEach(() => rmSync(dir, { recursive: true, force: true }));

export async function makeRecord(city = "Pune"): Promise<HistoryRecord> {
  const result = await runSoilAnalysis({ imageBytes: makePng(), city, config: getServerConfig({ AI_PROVIDER: "mock" }) });
  return { id: result.id, createdAt: result.createdAt, city, category: result.classification.category, confidence: result.classification.confidence, summary: result.summary, thumbnail: null, result };
}

describe("FileHistoryStore", () => {
  it("persists records across store instances and clears them", async () => {
    const file = path.join(dir, "nested", "history.json");
    const a = new FileHistoryStore(file);
    const r1 = await makeRecord("Pune");
    const r2 = await makeRecord("Nairobi");
    await Promise.all([a.add(r1), a.add(r2)]);
    const b = new FileHistoryStore(file);
    expect((await b.list()).map(r => r.city).sort()).toEqual(["Nairobi", "Pune"]);
    expect((await b.get(r1.id))?.result.id).toBe(r1.id);
    expect(await b.get("00000000-0000-4000-8000-000000000000")).toBeNull();
    expect(await b.clear()).toBe(2);
    expect(await new FileHistoryStore(file).list()).toEqual([]);
  });

  it("tolerates a corrupted history file", async () => {
    const file = path.join(dir, "history.json");
    writeFileSync(file, "{corrupt");
    expect(await new FileHistoryStore(file).list()).toEqual([]);
  });
});
