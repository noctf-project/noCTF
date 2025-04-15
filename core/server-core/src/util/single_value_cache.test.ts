import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { SingleValueCache } from "./single_value_cache.ts";

const createDelayedResolver = (values: any[], delay = 50) => {
  return vi.fn().mockImplementation(() => {
    const value = values.shift();
    return new Promise((resolve) => {
      setTimeout(() => resolve(value), delay);
    });
  });
};

describe(SingleValueCache, () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should fetch value on first get", async () => {
    const mockResolver = vi.fn().mockResolvedValue("test-data");
    const cache = new SingleValueCache<string>(mockResolver, 1000);

    const result = await cache.get();

    expect(mockResolver).toHaveBeenCalledTimes(1);
    expect(result).toBe("test-data");
  });

  it("should return cached value within TTL", async () => {
    const mockResolver = vi.fn().mockResolvedValue("test-data");
    const cache = new SingleValueCache<string>(mockResolver, 1000);

    await cache.get();
    vi.advanceTimersByTime(500);
    await cache.get();
    expect(mockResolver).toHaveBeenCalledTimes(1);
  });

  it("should fetch new value after TTL expires", async () => {
    const mockResolver = vi
      .fn()
      .mockResolvedValueOnce("test-data-1")
      .mockResolvedValueOnce("test-data-2");
    const cache = new SingleValueCache<string>(mockResolver, 1000);

    const result1 = await cache.get();
    const result2 = await cache.get();
    vi.advanceTimersByTime(1001);
    const result3 = await cache.get();

    expect(mockResolver).toHaveBeenCalledTimes(2);
    expect(result1).toBe("test-data-1");
    expect(result2).toBe("test-data-1");
    expect(result3).toBe("test-data-2");
  });

  it("should return correct TTL value", async () => {
    const mockResolver = vi.fn().mockResolvedValue("test-data");
    const cache = new SingleValueCache<string>(mockResolver, 1000);

    expect(cache.ttl()).toBe(0);

    await cache.get();
    expect(cache.ttl()).toBeGreaterThan(0);
    expect(cache.ttl()).toBeLessThanOrEqual(1000);

    vi.advanceTimersByTime(500);
    expect(cache.ttl()).toBeLessThanOrEqual(500);

    vi.advanceTimersByTime(501);
    expect(cache.ttl()).toBe(0);
  });

  it("should clear cached value", async () => {
    const mockResolver = vi.fn().mockResolvedValue("test-data");
    const cache = new SingleValueCache<string>(mockResolver, 1000);

    await cache.get();
    cache.clear();
    await cache.get();
    expect(mockResolver).toHaveBeenCalledTimes(2);
  });

  it("should handle concurrent get calls with a single fetch", async () => {
    let resolvePromise: (value: string) => void;
    const promise = new Promise<string>((resolve) => {
      resolvePromise = resolve;
    });

    const mockResolver = vi.fn().mockReturnValue(promise);
    const cache = new SingleValueCache<string>(mockResolver, 1000);

    const promise1 = cache.get();
    const promise2 = cache.get();

    resolvePromise!("test-data");

    const [result1, result2] = await Promise.all([promise1, promise2]);

    expect(mockResolver).toHaveBeenCalledTimes(1);
    expect(result1).toBe("test-data");
    expect(result2).toBe("test-data");
  });

  it("should handle errors from resolver", async () => {
    const error = new Error("Failed to fetch");
    const mockResolver = vi.fn().mockRejectedValue(error);
    const cache = new SingleValueCache<string>(mockResolver, 1000);

    await expect(cache.get()).rejects.toThrow(error);

    mockResolver.mockResolvedValueOnce("test-data");
    const result = await cache.get();
    expect(result).toBe("test-data");
  });

  describe("with allowStale option", () => {
    it("should return stale value immediately while fetching new one", async () => {
      const mockResolver = vi
        .fn()
        .mockReturnValueOnce(Promise.resolve("initial-data"))
        .mockReturnValueOnce(Promise.resolve("updated-data"));

      const cache = new SingleValueCache<string>(mockResolver, 1000, true);
      await cache.get();
      expect(mockResolver).toHaveBeenCalledTimes(1);
      vi.advanceTimersByTime(1001);

      const staleResult = await cache.get();

      expect(staleResult).toBe("initial-data");

      vi.advanceTimersByTime(100);

      const freshResult = await cache.get();
      expect(freshResult).toBe("updated-data");
    });

    it("should handle concurrent calls with stale value correctly", async () => {
      const mockResolver = vi
        .fn()
        .mockReturnValueOnce(Promise.resolve("initial-data"))
        .mockReturnValueOnce(Promise.resolve("updated-data"));

      const cache = new SingleValueCache<string>(mockResolver, 1000, true);
      const promise1 = cache.get();
      const promise2 = cache.get();
      expect(await Promise.all([promise1, promise2])).toEqual([
        "initial-data",
        "initial-data",
      ]);
      expect(mockResolver).toHaveBeenCalledTimes(1);
      vi.advanceTimersByTime(1001);

      const promise3 = cache.get();
      const promise4 = cache.get();
      expect(await Promise.all([promise3, promise4])).toEqual([
        "initial-data",
        "initial-data",
      ]);
      vi.advanceTimersByTime(100);

      const promise5 = cache.get();
      const promise6 = cache.get();
      expect(await Promise.all([promise5, promise6])).toEqual([
        "updated-data",
        "updated-data",
      ]);
    });

    it("should not return stale value if option is disabled", async () => {
      const mockResolver = vi
        .fn()
        .mockResolvedValueOnce("initial-data")
        .mockResolvedValueOnce("updated-data");

      const cache = new SingleValueCache<string>(mockResolver, 1000);

      await cache.get();

      vi.advanceTimersByTime(1001);

      const result = await cache.get();

      expect(result).toBe("updated-data");
      expect(mockResolver).toHaveBeenCalledTimes(2);
    });
  });
});
