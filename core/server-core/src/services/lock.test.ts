import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { anyString, mock } from "vitest-mock-extended";
import { LockService } from "./lock.ts";
import type { RedisClientFactory } from "../clients/redis.ts";
import type { createClient } from "redis";
import { Logger } from "../types/primitives.ts";

describe("LockService", () => {
  const redisClientFactory = mock<RedisClientFactory>();
  const logger = mock<Logger>();
  const redisClient = mock<ReturnType<typeof createClient>>();

  beforeEach(() => {
    redisClientFactory.getClient.mockResolvedValue(redisClient);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it("Acquires a lease", async () => {
    const service = new LockService({ logger, redisClientFactory });
    redisClient.set.mockResolvedValue("OK");
    await service.acquireLease("lol", 60);
  });

  it("Fails to acquire a lease if one already exists", async () => {
    const service = new LockService({ logger, redisClientFactory });
    redisClient.set.mockResolvedValue(null);
    await expect(() => service.acquireLease("lol", 60)).rejects.toThrow(
      "lease already exists",
    );
    expect(redisClient.set).toBeCalledWith("lease:lol", anyString(), {
      EX: 60,
      NX: true,
    });
  });

  it("Renews a lease", async () => {
    const service = new LockService({ logger, redisClientFactory });
    redisClientFactory.executeScript.mockResolvedValue(1);
    await service.renewLease("lol", "token", 60);
    expect(redisClientFactory.executeScript).toBeCalledWith(
      anyString(),
      ["lease:lol"],
      ["token", "60"],
    );
  });

  it("Renews a lease - exec throws another error", async () => {
    const service = new LockService({ logger, redisClientFactory });
    redisClientFactory.executeScript.mockRejectedValue(new Error("lol"));
    await expect(() => service.renewLease("lol", "token", 60)).rejects.toThrow(
      "lol",
    );
  });

  it("Fails to renew a lease", async () => {
    const service = new LockService({ logger, redisClientFactory });
    redisClientFactory.executeScript.mockResolvedValue(0);
    await expect(() => service.renewLease("lol", "token", 60)).rejects.toThrow(
      "lease token mismatch",
    );
  });

  it("Drops a lease", async () => {
    const service = new LockService({ logger, redisClientFactory });
    redisClientFactory.executeScript.mockResolvedValue(1);
    await service.dropLease("lol", "token");
    expect(redisClientFactory.executeScript).toBeCalledWith(
      anyString(),
      ["lease:lol"],
      ["token", "0"],
    );
  });

  it("Fails to drop a lease", async () => {
    const service = new LockService({ logger, redisClientFactory });
    redisClient.evalSha.mockResolvedValue(0);
    await expect(() => service.dropLease("lol", "token")).rejects.toThrow(
      "lease token mismatch",
    );
  });

  it("Drops a lease forcefully", async () => {
    const service = new LockService({ logger, redisClientFactory });
    await service.dropLease("lol");
    expect(redisClient.del).toBeCalledWith("lease:lol");
    expect(redisClient.evalSha).not.toHaveBeenCalled();
  });

  describe("withLease", () => {
    it("runs handler and releases lease on success", async () => {
      const service = new LockService({ logger, redisClientFactory });
      redisClient.set.mockResolvedValue("OK");
      redisClientFactory.executeScript.mockResolvedValue(1);

      let signalReceived: AbortSignal | undefined;
      const res = await service.withLease("test-job", async (signal) => {
        signalReceived = signal;
        return 42;
      });

      expect(res).toBe(42);
      expect(signalReceived?.aborted).toBe(false);
      // Ensure dropLease was executed
      expect(redisClientFactory.executeScript).toHaveBeenCalledWith(
        anyString(),
        ["lease:test-job"],
        [anyString(), "0"],
      );
    });

    it("aborts immediately if renewLease throws LockServiceError (token mismatch)", async () => {
      vi.useFakeTimers();
      try {
        const service = new LockService({ logger, redisClientFactory });
        redisClient.set.mockResolvedValue("OK");
        // Token mismatch script returns 0 -> LockServiceError
        redisClientFactory.executeScript.mockResolvedValue(0);

        let aborted = false;

        const promise = service.withLease(
          "test-job",
          async (signal) => {
            await new Promise<void>((resolve) => {
              signal.addEventListener("abort", () => {
                aborted = true;
                resolve();
              });
            });
          },
          {
            renewIntervalSeconds: 1,
            leaseDurationSeconds: 3,
          },
        );

        await vi.advanceTimersByTimeAsync(1100);
        await promise;

        expect(aborted).toBe(true);
      } finally {
        vi.useRealTimers();
      }
    });

    it("aborts after maxFailedRenewAttempts on consecutive generic errors", async () => {
      vi.useFakeTimers();
      try {
        const service = new LockService({ logger, redisClientFactory });
        redisClient.set.mockResolvedValue("OK");
        // Generic network error
        redisClientFactory.executeScript.mockRejectedValue(
          new Error("Redis connection dropped"),
        );

        let aborted = false;

        const promise = service.withLease(
          "test-job",
          async (signal) => {
            await new Promise<void>((resolve) => {
              signal.addEventListener("abort", () => {
                aborted = true;
                resolve();
              });
            });
          },
          {
            renewIntervalSeconds: 1,
            leaseDurationSeconds: 3,
            maxFailedRenewAttempts: 2,
          },
        );

        // 1st failure - should not abort yet
        await vi.advanceTimersByTimeAsync(1100);
        expect(aborted).toBe(false);

        // 2nd failure - reaches maxFailedRenewAttempts and aborts
        await vi.advanceTimersByTimeAsync(1000);
        await promise;

        expect(aborted).toBe(true);
      } finally {
        vi.useRealTimers();
      }
    });
  });
});
