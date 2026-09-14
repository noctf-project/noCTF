import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mockDeep, type DeepMockProxy } from "vitest-mock-extended";
import { LocalCache } from "./local_cache.ts";
import type { MetricsClient } from "../clients/metrics.ts";

describe(LocalCache, () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("synchronous loader", () => {
    it("should call loader and cache synchronous value", () => {
      const cache = new LocalCache<string, number>({ ttl: 60000 });
      const loader = vi.fn().mockReturnValue(42);

      const val1 = cache.load("key1", loader);
      expect(val1).toBe(42);
      expect(loader).toHaveBeenCalledTimes(1);

      const val2 = cache.load("key1", loader);
      expect(val2).toBe(42);
      expect(loader).toHaveBeenCalledTimes(1);
    });

    it("should respect TTL for synchronous values", async () => {
      const cache = new LocalCache<string, string>({ ttl: 60000 });
      const loader = vi
        .fn()
        .mockReturnValueOnce("hello")
        .mockReturnValueOnce("world");

      const val1 = cache.load("key1", loader, { ttl: 20 });
      expect(val1).toBe("hello");
      expect(loader).toHaveBeenCalledTimes(1);

      await new Promise((resolve) => setTimeout(resolve, 5));
      const val2 = cache.load("key1", loader, { ttl: 20 });
      expect(val2).toBe("hello");
      expect(loader).toHaveBeenCalledTimes(1);

      await new Promise((resolve) => setTimeout(resolve, 30));
      const val3 = cache.load("key1", loader, { ttl: 20 });
      expect(val3).toBe("world");
      expect(loader).toHaveBeenCalledTimes(2);
    });

    it("should compute dynamic TTL from function for synchronous values", async () => {
      const cache = new LocalCache<string, number>({ ttl: 60000 });
      const loader = vi.fn().mockReturnValueOnce(20).mockReturnValueOnce(2000);
      const setTTL = vi.fn((v: number) => ({ ttl: v }));

      const val1 = cache.load("key1", loader, setTTL);
      expect(val1).toBe(20);
      expect(setTTL).toHaveBeenCalledWith(20);

      await new Promise((resolve) => setTimeout(resolve, 5));
      expect(cache.load("key1", loader, setTTL)).toBe(20);
      expect(loader).toHaveBeenCalledTimes(1);

      await new Promise((resolve) => setTimeout(resolve, 30));
      const val2 = cache.load("key1", loader, setTTL);
      expect(val2).toBe(2000);
      expect(loader).toHaveBeenCalledTimes(2);
    });
  });

  describe("asynchronous loader", () => {
    it("should call loader and cache resolved promise value", async () => {
      const cache = new LocalCache<string, string>({ ttl: 60000 });
      const loader = vi.fn().mockResolvedValue("async-result");

      const promise1 = cache.load("key1", loader);
      expect(promise1).toBeInstanceOf(Promise);
      const result1 = await promise1;
      expect(result1).toBe("async-result");
      expect(loader).toHaveBeenCalledTimes(1);

      const cached = cache.load("key1", loader);
      expect(cached).toBe("async-result");
      expect(loader).toHaveBeenCalledTimes(1);
    });

    it("should deduplicate concurrent in-flight requests for the same key", async () => {
      const cache = new LocalCache<string, string>({ ttl: 60000 });
      let resolvePromise: (value: string) => void;
      const loader = vi.fn().mockImplementation(
        () =>
          new Promise<string>((resolve) => {
            resolvePromise = resolve;
          }),
      );

      const p1 = cache.load("key1", loader);
      const p2 = cache.load("key1", loader);

      expect(loader).toHaveBeenCalledTimes(1);

      resolvePromise!("concurrent-result");

      const [res1, res2] = await Promise.all([p1, p2]);
      expect(res1).toBe("concurrent-result");
      expect(res2).toBe("concurrent-result");
    });

    it("should remove entry from cache if promise rejects and allow retry", async () => {
      const cache = new LocalCache<string, string>({ ttl: 60000 });
      const error = new Error("fetch failed");
      const loader = vi
        .fn()
        .mockRejectedValueOnce(error)
        .mockResolvedValueOnce("success");

      await expect(cache.load("key1", loader)).rejects.toThrow("fetch failed");
      expect(loader).toHaveBeenCalledTimes(1);

      const result = await cache.load("key1", loader);
      expect(result).toBe("success");
      expect(loader).toHaveBeenCalledTimes(2);
    });

    it("should respect TTL for async values", async () => {
      const cache = new LocalCache<string, string>({ ttl: 60000 });
      const loader = vi
        .fn()
        .mockResolvedValueOnce("val-1")
        .mockResolvedValueOnce("val-2");

      const res1 = await cache.load("key1", loader, { ttl: 20 });
      expect(res1).toBe("val-1");
      expect(loader).toHaveBeenCalledTimes(1);

      await new Promise((resolve) => setTimeout(resolve, 5));
      const res2 = cache.load("key1", loader, { ttl: 20 });
      expect(res2).toBe("val-1");
      expect(loader).toHaveBeenCalledTimes(1);

      await new Promise((resolve) => setTimeout(resolve, 30));
      const res3 = await cache.load("key1", loader, { ttl: 20 });
      expect(res3).toBe("val-2");
      expect(loader).toHaveBeenCalledTimes(2);
    });

    it("should compute dynamic TTL from function for async values", async () => {
      const cache = new LocalCache<string, { ttlMs: number; text: string }>({
        ttl: 60000,
      });
      const loader = vi
        .fn()
        .mockResolvedValueOnce({ ttlMs: 20, text: "quick" })
        .mockResolvedValueOnce({ ttlMs: 1000, text: "slow" });
      const setTTL = vi.fn((v: { ttlMs: number; text: string }) => ({
        ttl: v.ttlMs,
      }));

      const res1 = await cache.load("key1", loader, setTTL);
      expect(res1).toEqual({ ttlMs: 20, text: "quick" });
      expect(setTTL).toHaveBeenCalledWith({ ttlMs: 20, text: "quick" });

      await new Promise((resolve) => setTimeout(resolve, 5));
      expect(cache.load("key1", loader, setTTL)).toEqual({
        ttlMs: 20,
        text: "quick",
      });
      expect(loader).toHaveBeenCalledTimes(1);

      await new Promise((resolve) => setTimeout(resolve, 30));
      const res2 = await cache.load("key1", loader, setTTL);
      expect(res2).toEqual({ ttlMs: 1000, text: "slow" });
      expect(loader).toHaveBeenCalledTimes(2);
    });
  });

  describe("delete and clear", () => {
    it("should remove specific key via delete()", () => {
      const cache = new LocalCache<string, string>({ ttl: 60000 });
      const loader = vi
        .fn()
        .mockReturnValueOnce("val1")
        .mockReturnValueOnce("val2");

      cache.load("key1", loader);
      expect(loader).toHaveBeenCalledTimes(1);

      cache.delete("key1");

      const res = cache.load("key1", loader);
      expect(res).toBe("val2");
      expect(loader).toHaveBeenCalledTimes(2);
    });

    it("should remove all keys via clear()", () => {
      const cache = new LocalCache<string, string>({ ttl: 60000 });
      const loaderA = vi
        .fn()
        .mockReturnValueOnce("a1")
        .mockReturnValueOnce("a2");
      const loaderB = vi
        .fn()
        .mockReturnValueOnce("b1")
        .mockReturnValueOnce("b2");

      cache.load("keyA", loaderA);
      cache.load("keyB", loaderB);

      cache.clear();

      expect(cache.load("keyA", loaderA)).toBe("a2");
      expect(cache.load("keyB", loaderB)).toBe("b2");
      expect(loaderA).toHaveBeenCalledTimes(2);
      expect(loaderB).toHaveBeenCalledTimes(2);
    });
  });

  describe("options and max entries (eviction)", () => {
    it("should evict oldest entry when max capacity is reached", () => {
      const cache = new LocalCache<string, string>({ max: 2, ttl: 60000 });
      const loader = vi.fn((key: string) => `value-${key}`);

      cache.load("a", () => loader("a"));
      cache.load("b", () => loader("b"));

      // Accessing a third key should evict the oldest key ("a")
      cache.load("c", () => loader("c"));

      // "a" was evicted, so loader should be called again for "a"
      cache.load("a", () => loader("a"));
      expect(loader).toHaveBeenCalledTimes(4);
    });
  });

  describe("disposeMetricsHook", () => {
    let mockMetrics: DeepMockProxy<MetricsClient>;

    beforeEach(() => {
      mockMetrics = mockDeep<MetricsClient>();
    });

    it("should record aggregate metrics on evict reason", () => {
      const disposer = LocalCache.disposeMetricsHook(mockMetrics, "test_cache");

      disposer("val", "key", "evict");

      expect(mockMetrics.recordAggregate).toHaveBeenCalledWith(
        [["EvictedCount", 1]],
        { local_cache: "test_cache" },
      );
    });

    it("should not record metrics for non-evict reasons (e.g. delete, set, stale)", () => {
      const disposer = LocalCache.disposeMetricsHook(mockMetrics, "test_cache");

      disposer("val", "key", "delete");
      disposer("val", "key", "set");
      disposer("val", "key", "stale");

      expect(mockMetrics.recordAggregate).not.toHaveBeenCalled();
    });

    it("should integrate disposeMetricsHook with LocalCache options on eviction", () => {
      const cache = new LocalCache<string, string>({
        max: 1,
        ttl: 60000,
        dispose: LocalCache.disposeMetricsHook(mockMetrics, "my_cache"),
      });

      cache.load("k1", () => "v1");
      cache.load("k2", () => "v2"); // triggers eviction of k1

      expect(mockMetrics.recordAggregate).toHaveBeenCalledTimes(1);
      expect(mockMetrics.recordAggregate).toHaveBeenCalledWith(
        [["EvictedCount", 1]],
        { local_cache: "my_cache" },
      );
    });
  });
});
