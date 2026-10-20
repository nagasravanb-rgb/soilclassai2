import { mkdtempSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { FileHistoryStore } from "@/lib/history/store";
import { makeRecord } from "../helpers";

let dir: string;
beforeEach(() => { dir = mkdtempSync(path.join(tmpdir(), "soilclass-")); });
afterEach(() => rmSync(dir, { recursive: true, force: true }));

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

describe("FileHistoryStore across processes", () => {
  it("does not lose records when separate store instances write concurrently", async () => {
    const file = path.join(dir, "shared.json");
    const stores = Array.from({ length: 4 }, () => new FileHistoryStore(file));
    const records = await Promise.all(Array.from({ length: 12 }, (_, i) => makeRecord(`City ${String.fromCharCode(65 + i)}`)));
    await Promise.all(records.map((r, i) => stores[i % stores.length].add(r)));
    expect(await new FileHistoryStore(file).list()).toHaveLength(12);
  });
});
