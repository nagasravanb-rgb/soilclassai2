// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { browserHistory, getHistoryBackend, HistoryQuotaError, resetHistoryBackendCache, writeLocal } from "@/lib/client/api";
import { makeRecord } from "../helpers";

const KEY = "soilclass.history.v1";

describe("browser history storage", () => {
  beforeEach(() => { window.localStorage.clear(); resetHistoryBackendCache(); });
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

  it("keeps existing history and throws when the new record cannot fit", async () => {
    const old = await makeRecord("Pune");
    await browserHistory.add(old);
    const before = window.localStorage.getItem(KEY);
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new DOMException("full", "QuotaExceededError"); });
    await expect(browserHistory.add(await makeRecord("Lima"))).rejects.toBeInstanceOf(HistoryQuotaError);
    expect(window.localStorage.getItem(KEY)).toBe(before);
  });

  it("drops the thumbnail before dropping older records", async () => {
    const old = await makeRecord("Pune");
    const next = { ...(await makeRecord("Lima")), thumbnail: "data:image/jpeg;base64,AAAA" };
    const real = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (this: Storage, k: string, v: string) {
      if (v.includes("data:image")) throw new DOMException("full", "QuotaExceededError");
      return real.call(this, k, v);
    });
    expect(writeLocal(next, [old])).toEqual({ droppedOlder: 0, thumbnailDropped: true });
    expect((await browserHistory.list()).map(r => r.city)).toEqual(["Lima", "Pune"]);
  });

  it("rejects records that would be discarded on read", async () => {
    const bad = { ...(await makeRecord("Pune")), thumbnail: "data:image/jpeg;base64," + "A".repeat(130_000) };
    expect(() => writeLocal(bad, [])).toThrow();
  });

  it("does not cache a fallback backend when the health check fails", async () => {
    const fetchMock = vi.fn().mockRejectedValueOnce(new TypeError("offline"))
      .mockResolvedValueOnce(new Response(JSON.stringify({ historyStorage: "file" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(getHistoryBackend()).rejects.toThrow();
    expect((await getHistoryBackend()).kind).toBe("file");
  });

  it("reuses the last confirmed browser mode when the server is unreachable", async () => {
    window.localStorage.setItem("soilclass.historyMode.v1", "browser");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("offline")));
    expect((await getHistoryBackend()).kind).toBe("browser");
  });
});
