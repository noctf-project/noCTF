import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { anyString, mock } from "vitest-mock-extended";
import { LockService } from "./lock.ts";
import type { RedisClientFactory } from "../clients/redis.ts";
import type { createClient } from "redis";
import { ErrorReply } from "redis";

describe("LockService", () => {
  const redisClientFactory = mock<RedisClientFactory>();
  const redisClient = mock<ReturnType<typeof createClient>>();

  beforeEach(() => {
    redisClientFactory.getClient.mockResolvedValue(redisClient);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it("Acquires a lease", async () => {
    const service = new LockService({ redisClientFactory });
    redisClient.set.mockResolvedValue("OK");
    await service.acquireLease("lol", 60);
  });

  it("Fails to acquire a lease if one already exists", async () => {
    const service = new LockService({ redisClientFactory });
    redisClient.set.mockResolvedValue(null);
    await expect(() => service.acquireLease("lol", 60)).rejects.toThrowError(
      "lease already exists",
    );
    expect(redisClient.set).toBeCalledWith("lease:lol", anyString(), {
      EX: 60,
      NX: true,
    });
  });

  it("Renews a lease", async () => {
    redisClient.scriptLoad.mockResolvedValue("aaa");
    const service = new LockService({ redisClientFactory });
    redisClient.evalSha.mockResolvedValue(1);
    await service.renewLease("lol", "token", 60);
    redisClient.scriptLoad.mockResolvedValue("aaa");
    expect(redisClient.evalSha).toBeCalledWith("aaa", {
      keys: ["lease:lol"],
      arguments: ["token", "60"],
    });
  });

  it("Renews a lease - lua not loaded", async () => {
    redisClient.scriptLoad.mockResolvedValue("aaa");
    const service = new LockService({ redisClientFactory });
    redisClient.evalSha
      .mockRejectedValueOnce(new ErrorReply("NOSCRIPT No matching script."))
      .mockResolvedValue("aaa");
    await service.renewLease("lol", "token", 60);
    redisClient.scriptLoad.mockResolvedValue("aaa");
    expect(redisClient.evalSha).toBeCalledWith("aaa", {
      keys: ["lease:lol"],
      arguments: ["token", "60"],
    });
  });

  it("Renews a lease - exec throws another error", async () => {
    redisClient.scriptLoad.mockResolvedValue("aaa");
    const service = new LockService({ redisClientFactory });
    redisClient.evalSha.mockRejectedValue(new Error("lol"));
    await expect(() =>
      service.renewLease("lol", "token", 60),
    ).rejects.toThrowError("lol");
  });

  it("Fails to renew a lease", async () => {
    const service = new LockService({ redisClientFactory });
    redisClient.evalSha.mockResolvedValue(0);
    await expect(() =>
      service.renewLease("lol", "token", 60),
    ).rejects.toThrowError("lease token mismatch");
  });

  it("Drops a lease", async () => {
    const service = new LockService({ redisClientFactory });
    redisClient.evalSha.mockResolvedValue(1);
    redisClient.scriptLoad.mockResolvedValue("aaa");
    await service.dropLease("lol", "token");
    expect(redisClient.evalSha).toBeCalledWith("aaa", {
      keys: ["lease:lol"],
      arguments: ["token", "0"],
    });
  });

  it("Fails to drop a lease", async () => {
    const service = new LockService({ redisClientFactory });
    redisClient.evalSha.mockResolvedValue(0);
    await expect(() => service.dropLease("lol", "token")).rejects.toThrowError(
      "lease token mismatch",
    );
  });

  it("Drops a lease forcefully", async () => {
    const service = new LockService({ redisClientFactory });
    await service.dropLease("lol");
    expect(redisClient.del).toBeCalledWith("lease:lol");
    expect(redisClient.evalSha).not.toHaveBeenCalled();
  });
});
