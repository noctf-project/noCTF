import { beforeEach, describe, expect, it, vi } from "vitest";
import { CacheService } from "./cache.ts";
import { Coleascer } from "../util/coleascer.ts";
import { mockDeep } from "vitest-mock-extended";
import { MetricsClient } from "../clients/metrics.ts";
import { RedisClientFactory } from "../clients/redis.ts";
import { encode } from "cbor-x";
import { Logger } from "../types/primitives.ts";

vi.mock(import("../util/coleascer.ts"), () => ({
  Coleascer: vi.fn(),
}));

vi.mock(import("../util/message_compression.ts"), () => ({
  Compress: async (x) => x as unknown as Uint8Array,
  Decompress: async (x) => x as unknown as Uint8Array,
}));

describe(CacheService, () => {
  const logger = mockDeep<Logger>();
  const metricsClient = mockDeep<MetricsClient>();
  const redisClientFactory = mockDeep<RedisClientFactory>();
  const redisClient =
    mockDeep<Awaited<ReturnType<RedisClientFactory["getClient"]>>>();

  const coleascer = mockDeep<Coleascer<unknown>>();
  beforeEach(() => {
    vi.mocked(Coleascer).mockReturnValue(coleascer);
    redisClientFactory.getClient.mockResolvedValue(redisClient);
  });

  it("loads stuff using the fetcher", async () => {
    const svc = new CacheService({ logger, metricsClient, redisClientFactory });
    coleascer.get.mockImplementation((_k, f) => f());
    const fetcher = async () => "loaded";
    expect(await svc.load("ns", "key", fetcher)).toEqual("loaded");
  });

  it("loads stuff using the cache if cached", async () => {
    const svc = new CacheService({ logger, metricsClient, redisClientFactory });
    coleascer.get.mockImplementation((_k, f) => f());
    const fetcher = async () => "loaded";
    // TODO: typescript is being annoying
    redisClient.get.mockResolvedValue(encode("cached") as unknown as string);
    expect(await svc.load("ns", "key", fetcher)).toEqual("cached");
  });
});
