import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { anyString, mock } from "vitest-mock-extended";
import { LockService } from "./lock.ts";
import { RedisClientFactory } from "../clients/redis_factory.ts";

describe("LockService", () => {
  const redisClientFactory = mock<RedisClientFactory>();
  const redisClient = mock<LockService["client"]>();

  beforeEach(() => {
    redisClientFactory.getSharedClient.mockReturnValue(redisClient);
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
    expect(redisClient.set).toBeCalledWith(
      "lease:lol",
      anyString(),
      "EX",
      60,
      "NX",
    );
  });

  it("Renews a lease", async () => {
    const service = new LockService({ redisClientFactory });
    redisClient.svcLeaseRenew.mockResolvedValue(1);
    await service.renewLease("lol", "token", 60);
    expect(redisClient.svcLeaseRenew).toBeCalledWith("lease:lol", "token", 60);
  });

  it("Fails to renew a lease", async () => {
    const service = new LockService({ redisClientFactory });
    redisClient.svcLeaseRenew.mockResolvedValue(0);
    await expect(() =>
      service.renewLease("lol", "token", 60),
    ).rejects.toThrowError("lease token mismatch");
  });

  it("Drops a lease", async () => {
    const service = new LockService({ redisClientFactory });
    redisClient.svcLeaseRenew.mockResolvedValue(1);
    await service.dropLease("lol", "token");
    expect(redisClient.svcLeaseRenew).toBeCalledWith("lease:lol", "token", 0);
  });

  it("Fails to drop a lease", async () => {
    const service = new LockService({ redisClientFactory });
    redisClient.svcLeaseRenew.mockResolvedValue(0);
    await expect(() => service.dropLease("lol", "token")).rejects.toThrowError(
      "lease token mismatch",
    );
  });

  it("Drops a lease forcefully", async () => {
    const service = new LockService({ redisClientFactory });
    await service.dropLease("lol");
    expect(redisClient.del).toBeCalledWith("lease:lol");
    expect(redisClient.svcLeaseRenew).not.toHaveBeenCalled;
  });
});
