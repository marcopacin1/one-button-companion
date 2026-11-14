import { describe, expect, it, vi } from "vitest";
import { TtlCache } from "./cache.js";

describe("TtlCache", () => {
  it("shares one in-flight load between concurrent callers", async () => {
    const cache = new TtlCache();
    const load = vi.fn(async () => {
      await new Promise((r) => setTimeout(r, 10));
      return 42;
    });
    const results = await Promise.all([1, 2, 3, 4, 5].map(() => cache.get("k", 1000, load)));
    expect(load).toHaveBeenCalledTimes(1);
    expect(results.every((r) => r.value === 42)).toBe(true);
  });

  it("reloads after the TTL", async () => {
    let t = 0;
    const cache = new TtlCache(() => t);
    const load = vi.fn(async () => t);
    expect((await cache.get("k", 100, load)).value).toBe(0);
    t = 50;
    expect((await cache.get("k", 100, load)).value).toBe(0);
    t = 150;
    expect((await cache.get("k", 100, load)).value).toBe(150);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("serves the last good value, marked stale, when a refresh fails", async () => {
    let t = 0;
    const cache = new TtlCache(() => t);
    await cache.get("k", 100, async () => "good");
    t = 200;
    const r = await cache.get("k", 100, async () => {
      throw new Error("Roblox down");
    });
    expect(r).toMatchObject({ value: "good", stale: true });
  });

  it("propagates the error when there is nothing to fall back on", async () => {
    const cache = new TtlCache();
    await expect(
      cache.get("k", 100, async () => {
        throw new Error("nope");
      }),
    ).rejects.toThrow("nope");
    // And the failure is not cached.
    expect((await cache.get("k", 100, async () => "ok")).value).toBe("ok");
  });
});
