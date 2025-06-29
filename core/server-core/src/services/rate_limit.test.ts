import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mockDeep } from "vitest-mock-extended";
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

  describe(RateLimitService.prototype.evaluate, () => {
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

  describe(RateLimitService.prototype.refund, () => {
    it("should refund requests in the current window", async () => {
      const buckets: RateLimitBucket[] = [
        { key: "test", windowSeconds: 60, limit: 100 },
      ];

      mockRedisClient.multi.mockReturnValue({
        incrBy: vi.fn().mockReturnThis(),
        expireAt: vi.fn().mockReturnThis(),
        exec: vi.fn().mockResolvedValue([]),
      } as Partial<ReturnType<typeof mockRedisClient.multi>> as ReturnType<
        typeof mockRedisClient.multi
      >);

      // Set up initial state by making a request
      mockRedisClient.mGet.mockResolvedValueOnce(["0", "0"]);
      await service.evaluate(buckets);

      // Refund the request using the same timestamp
      const refundTime = 1000 * 1000; // Same as the current time
      await service.refund(refundTime, buckets);

      // Trigger dump
      vi.advanceTimersByTime(25);
      await Promise.resolve();

      // The refund should have decremented the current window counter
      // So no increment should be written to Redis
      expect(mockRedisClient.multi().incrBy).not.toHaveBeenCalled();
    });

    it("should refund requests in the previous window", async () => {
      const buckets: RateLimitBucket[] = [
        { key: "test", windowSeconds: 60, limit: 100 },
      ];

      // Current time is 1000 seconds (window 960-1020)
      // Previous window would be 900-960
      const previousWindowTime = 950 * 1000; // 950 seconds = previous window

      // Make a request first to establish state
      mockRedisClient.mGet.mockResolvedValueOnce(["0", "0"]);
      await service.evaluate(buckets);

      // Now refund a request from the previous window
      await service.refund(previousWindowTime, buckets);

      // Set up mock for the dump
      mockRedisClient.multi.mockReturnValue({
        incrBy: vi.fn().mockReturnThis(),
        expireAt: vi.fn().mockReturnThis(),
        exec: vi.fn().mockResolvedValue([]),
      } as Partial<ReturnType<typeof mockRedisClient.multi>> as ReturnType<
        typeof mockRedisClient.multi
      >);

      // Trigger dump
      vi.advanceTimersByTime(25);
      await Promise.resolve();

      // Should have written the current window increment but decremented previous
      expect(mockRedisClient.multi().incrBy).toHaveBeenCalledWith(
        "core:rl:bucket:960:60:test",
        1,
      );
    });

    it("should refund requests in the next window", async () => {
      const buckets: RateLimitBucket[] = [
        { key: "test", windowSeconds: 60, limit: 100 },
      ];

      // Current time is 1000 seconds (window 960-1020)
      // Next window would be 1020-1080
      const nextWindowTime = 1050 * 1000; // 1050 seconds = next window

      // Make a request first
      mockRedisClient.mGet.mockResolvedValueOnce(["0", "0"]);
      await service.evaluate(buckets);

      // Refund a request from the next window
      await service.refund(nextWindowTime, buckets);

      mockRedisClient.multi.mockReturnValue({
        incrBy: vi.fn().mockReturnThis(),
        expireAt: vi.fn().mockReturnThis(),
        exec: vi.fn().mockResolvedValue([]),
      } as Partial<ReturnType<typeof mockRedisClient.multi>> as ReturnType<
        typeof mockRedisClient.multi
      >);

      // Trigger dump
      vi.advanceTimersByTime(25);
      await Promise.resolve();

      // Should have written the current window increment
      expect(mockRedisClient.multi().incrBy).toHaveBeenCalledWith(
        "core:rl:bucket:960:60:test",
        1,
      );
    });

    it("should handle refund for non-existent write entry", async () => {
      const buckets: RateLimitBucket[] = [
        { key: "newkey", windowSeconds: 60, limit: 100 },
      ];

      // Refund without any prior evaluate call
      const refundTime = 1000 * 1000;
      await service.refund(refundTime, buckets);

      mockRedisClient.multi.mockReturnValue({
        incrBy: vi.fn().mockReturnThis(),
        expireAt: vi.fn().mockReturnThis(),
        exec: vi.fn().mockResolvedValue([]),
      } as Partial<ReturnType<typeof mockRedisClient.multi>> as ReturnType<
        typeof mockRedisClient.multi
      >);

      // Trigger dump
      vi.advanceTimersByTime(25);
      await Promise.resolve();

      // Write a -1 as the key probably got removed from memory
      expect(mockRedisClient.multi().incrBy).toHaveBeenCalledWith(
        "core:rl:bucket:960:60:newkey",
        -1,
      );
    });

    it("should handle multiple refunds for the same bucket", async () => {
      const buckets: RateLimitBucket[] = [
        { key: "test", windowSeconds: 60, limit: 100 },
      ];

      // Make multiple requests first
      mockRedisClient.mGet.mockResolvedValueOnce(["0", "0"]);
      await service.evaluate(buckets);

      mockRedisClient.mGet.mockResolvedValueOnce(["0", "1"]);
      await service.evaluate(buckets);

      // Refund both requests
      const refundTime = 1000 * 1000;
      await service.refund(refundTime, buckets);
      await service.refund(refundTime, buckets);

      mockRedisClient.multi.mockReturnValue({
        incrBy: vi.fn().mockReturnThis(),
        expireAt: vi.fn().mockReturnThis(),
        exec: vi.fn().mockResolvedValue([]),
      } as Partial<ReturnType<typeof mockRedisClient.multi>> as ReturnType<
        typeof mockRedisClient.multi
      >);

      // Trigger dump
      vi.advanceTimersByTime(25);
      await Promise.resolve();

      // Should not increment anything since both requests were refunded
      expect(mockRedisClient.multi().incrBy).not.toHaveBeenCalled();
    });

    it("should handle refunds for multiple buckets with different windows", async () => {
      const buckets: RateLimitBucket[] = [
        { key: "test1", windowSeconds: 60, limit: 100 },
        { key: "test2", windowSeconds: 120, limit: 200 },
      ];

      // Make requests for both buckets
      mockRedisClient.mGet.mockResolvedValueOnce(["0", "0", "0", "0"]);
      await service.evaluate(buckets);
      await service.evaluate(buckets);

      // Refund both
      const refundTime = 1000 * 1000;
      await service.refund(refundTime, buckets);

      mockRedisClient.multi.mockReturnValue({
        incrBy: vi.fn().mockReturnThis(),
        expireAt: vi.fn().mockReturnThis(),
        exec: vi.fn().mockResolvedValue([]),
      } as Partial<ReturnType<typeof mockRedisClient.multi>> as ReturnType<
        typeof mockRedisClient.multi
      >);

      // Trigger dump
      vi.advanceTimersByTime(25);
      await Promise.resolve();

      // Neither bucket should have increments since both were refunded
      expect(mockRedisClient.multi().incrBy).toHaveBeenCalledWith(
        "core:rl:bucket:960:60:test1",
        1,
      );
      expect(mockRedisClient.multi().incrBy).toHaveBeenCalledWith(
        "core:rl:bucket:960:120:test2",
        1,
      );
    });

    it("should ignore refunds for windows outside the tracking range", async () => {
      const buckets: RateLimitBucket[] = [
        { key: "test", windowSeconds: 60, limit: 100 },
      ];

      // Make a request first
      mockRedisClient.mGet.mockResolvedValueOnce(["0", "0"]);
      await service.evaluate(buckets);

      // Try to refund from a window that's too far in the past
      const oldWindowTime = 800 * 1000; // Way before current window
      await service.refund(oldWindowTime, buckets);

      mockRedisClient.multi.mockReturnValue({
        incrBy: vi.fn().mockReturnThis(),
        expireAt: vi.fn().mockReturnThis(),
        exec: vi.fn().mockResolvedValue([]),
      } as Partial<ReturnType<typeof mockRedisClient.multi>> as ReturnType<
        typeof mockRedisClient.multi
      >);

      // Trigger dump
      vi.advanceTimersByTime(25);
      await Promise.resolve();

      // Should still increment the current window since refund was ignored
      expect(mockRedisClient.multi().incrBy).toHaveBeenCalledWith(
        "core:rl:bucket:960:60:test",
        1,
      );
    });

    it("should schedule dump timeout when refund is called", async () => {
      const buckets: RateLimitBucket[] = [
        { key: "test", windowSeconds: 60, limit: 100 },
      ];

      const refundTime = 1000 * 1000;
      await service.refund(refundTime, buckets);

      // Verify that timeout is set by checking if dump occurs
      mockRedisClient.multi.mockReturnValue({
        incrBy: vi.fn().mockReturnThis(),
        expireAt: vi.fn().mockReturnThis(),
        exec: vi.fn().mockResolvedValue([]),
      } as Partial<ReturnType<typeof mockRedisClient.multi>> as ReturnType<
        typeof mockRedisClient.multi
      >);

      vi.advanceTimersByTime(25);
      await Promise.resolve();

      // Even though no increments were made, the multi should be called due to the timeout
      expect(mockRedisClient.multi).toHaveBeenCalled();
    });
  });
});
