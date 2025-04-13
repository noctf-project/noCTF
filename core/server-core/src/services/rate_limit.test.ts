import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mockDeep, mockReset } from "vitest-mock-extended";
import TTLCache from "@isaacs/ttlcache";
import { RateLimitBucket, RateLimitService } from "./rate_limit.ts";
import { RedisClientFactory } from "../clients/redis.ts";
import { Logger } from "../types/primitives.ts";

vi.mock(import("@isaacs/ttlcache"));

describe(RateLimitService, () => {
  const mockRedisClient =
    mockDeep<Awaited<ReturnType<RedisClientFactory["getClient"]>>>();
  const mockRedisClientFactory = mockDeep<RedisClientFactory>();
  const mockLogger = mockDeep<Logger>();

  let service: RateLimitService;

  beforeEach(() => {
    mockRedisClientFactory.getClient.mockResolvedValue(mockRedisClient);
    vi.mocked(TTLCache).mockImplementation(
      () =>
        ({
          getRemainingTTL: vi.fn(),
          set: vi.fn(),
        }) as unknown as TTLCache<unknown, unknown>,
    );

    service = new RateLimitService({
      redisClientFactory: mockRedisClientFactory,
      logger: mockLogger,
    });
    vi.useFakeTimers();
    vi.setSystemTime(new Date(1000 * 1000)); // 1000 seconds
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.resetAllMocks();
  });

  it("should return null when not rate limited", async () => {
    const buckets: RateLimitBucket[] = [
      { key: "test", windowSeconds: 60, limit: 10 },
    ];

    mockRedisClient.mGet.mockResolvedValueOnce(["5", "2"]);

    const result = await service.evaluate(buckets);

    expect(result).toBeNull();
    expect(mockRedisClient.mGet).toHaveBeenCalledWith([
      "core:rl:bucket:900:60:test",
      "core:rl:bucket:960:60:test",
    ]);
  });

  it("should return block time when rate limited", async () => {
    const buckets: RateLimitBucket[] = [
      { key: "test", windowSeconds: 60, limit: 10 },
    ];

    mockRedisClient.mGet.mockResolvedValueOnce(["5", "8"]);

    const result = await service.evaluate(buckets);

    expect(result).not.toBeNull();
    expect(typeof result).toBe("number");
  });

  it("should return blocked time from cache if already blocked", async () => {
    const buckets: RateLimitBucket[] = [
      { key: "test", windowSeconds: 60, limit: 10 },
    ];

    // @ts-ignore - accessing private property for test
    const blocked = service["blocked"] as TTLCache<string, number>;
    vi.mocked(blocked.getRemainingTTL).mockReturnValueOnce(1030);

    const result = await service.evaluate(buckets);

    expect(result).toBe(1030);
    expect(mockRedisClient.mGet).not.toHaveBeenCalled();
  });

  it("should batch writes to Redis", async () => {
    const buckets: RateLimitBucket[] = [
      { key: "test1", windowSeconds: 60, limit: 100 },
      { key: "test2", windowSeconds: 120, limit: 200 },
    ];

    mockRedisClient.mGet.mockResolvedValueOnce(["0", "0", "0", "0"]);
    mockRedisClient.multi.mockReturnValue({
      incrBy: vi.fn().mockReturnThis(),
      expireAt: vi.fn().mockReturnThis(),
      exec: vi.fn().mockResolvedValue([]),
    } as Partial<ReturnType<typeof mockRedisClient.multi>> as ReturnType<
      typeof mockRedisClient.multi
    >);

    // First request
    await service.evaluate(buckets);

    // Advance time to trigger dump
    vi.advanceTimersByTime(25);
    await Promise.resolve();

    expect(mockRedisClient.multi).toHaveBeenCalled();
    expect(mockRedisClient.multi().incrBy).toHaveBeenCalledTimes(2);
    expect(mockRedisClient.multi().expireAt).toHaveBeenCalledTimes(2);
    expect(mockRedisClient.multi().exec).toHaveBeenCalled();
  });

  it("should handle Redis errors gracefully", async () => {
    const buckets: RateLimitBucket[] = [
      { key: "test", windowSeconds: 60, limit: 100 },
    ];

    mockRedisClient.mGet.mockResolvedValueOnce(["0", "0"]);
    mockRedisClient.multi.mockReturnValue({
      incrBy: vi.fn().mockReturnThis(),
      expireAt: vi.fn().mockReturnThis(),
      exec: vi.fn().mockRejectedValue(new Error("Redis error")),
    } as Partial<ReturnType<typeof mockRedisClient.multi>> as ReturnType<
      typeof mockRedisClient.multi
    >);
    const promise = Promise.withResolvers<void>();
    vi.mocked(mockLogger.error).mockImplementation(() => promise.resolve());

    // First request
    await service.evaluate(buckets);

    // Advance time to trigger dump
    vi.advanceTimersByTime(25);
    await promise.promise;
    expect(mockLogger.error).toHaveBeenCalled();
    mockRedisClient.mGet.mockResolvedValueOnce(["0", "0"]);
    const result = await service.evaluate(buckets);
    expect(result).toBeNull();
  });

  it("should reuse fetch results when multiple buckets request the same keys", async () => {
    const buckets: RateLimitBucket[] = [
      { key: "test", windowSeconds: 60, limit: 100 },
      { key: "test", windowSeconds: 60, limit: 50 },
    ];

    mockRedisClient.mGet.mockResolvedValueOnce(["0", "0"]);

    await service.evaluate(buckets);

    expect(mockRedisClient.mGet).toHaveBeenCalledTimes(1);
  });

  it("should handle concurrent requests with fetch locks", async () => {
    const buckets: RateLimitBucket[] = [
      { key: "test", windowSeconds: 60, limit: 100 },
    ];

    const delayed = Promise.withResolvers<(string | null)[]>();

    mockRedisClient.mGet.mockReturnValueOnce(delayed.promise);

    // Start two concurrent evaluations
    const promise1 = service.evaluate(buckets);
    const promise2 = service.evaluate(buckets);

    // Resolve the Redis call
    delayed.resolve(["0", "0"]);

    const [result1, result2] = await Promise.all([promise1, promise2]);

    expect(mockRedisClient.mGet).toHaveBeenCalledTimes(1);
    expect(result1).toBeNull();
    expect(result2).toBeNull();
  });

  it("if fetch fails then throw error and release locks", async () => {
    const buckets: RateLimitBucket[] = [
      { key: "test", windowSeconds: 60, limit: 100 },
    ];

    mockRedisClient.mGet.mockRejectedValueOnce(new Error("Redis error"));

    // Start two concurrent evaluations
    const promise1 = service.evaluate(buckets);
    const promise2 = service.evaluate(buckets);

    await expect(Promise.all([promise1, promise2])).rejects.toThrowError();
  });

  it("should calculate correct rate limit estimate", async () => {
    // Testing with values that would trigger a rate limit
    const buckets: RateLimitBucket[] = [
      { key: "test", windowSeconds: 60, limit: 10 },
    ];

    // Set current time to 30 seconds into the window
    vi.setSystemTime(new Date(1030 * 1000));

    // Previous window had 10 requests, current has 5
    mockRedisClient.mGet.mockResolvedValueOnce(["10", "5"]);

    const result = await service.evaluate(buckets);

    // This should be rate limited due to the estimate
    expect(result).not.toBeNull();
    expect(typeof result).toBe("number");
  });
});
