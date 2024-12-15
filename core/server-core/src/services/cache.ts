import { decode, encode } from "cbor2";
import { RedisUrlType } from "../clients/redis_factory.ts";
import { ServiceCradle } from "../index.ts";

type LoadParams<T> = {
  expireSeconds: number;
};
export type LoadOptions<T> = Partial<LoadParams<T>>;
const DEFAULT_LOAD_PARAMS: LoadParams<unknown> = {
  expireSeconds: 30,
};

type Props = Pick<ServiceCradle, "redisClientFactory" | "metricsClient">;

enum MetricIndex {
  HitCount = 0,
  HitTime = 1,
  MissCount = 2,
  MissTime = 3
};

const FLUSH_INTERVAL = 1000;

export class CacheService {
  private readonly redisClient;
  private readonly metricsClient;

  // Hit, HitTime, Miss, MissTime
  private counters: Map<string, [number, number, number, number]> = new Map();
  private lastFlush = performance.now();

  constructor({ redisClientFactory, metricsClient }: Props) {
    this.redisClient = redisClientFactory.getSharedClient(RedisUrlType.Cache);
    this.metricsClient = metricsClient;
  }

  async load<T>(
    namespace: string,
    key: string,
    fetcher: () => Promise<T>,
    options?: LoadOptions<T>,
  ): Promise<T> {
    const start = performance.now();
    const { expireSeconds } = {
      ...DEFAULT_LOAD_PARAMS,
      ...options,
    };
    const k = `${namespace}:${key}`;
    const data = await this.redisClient.getBuffer(k);
    if (data) {
      const d = decode(data) as T;
      const end = performance.now();
      this.recordMetric(namespace, [
        [MetricIndex.HitCount, 1],
        [MetricIndex.HitTime, end - start]], end);
      return d;
    }
      const result = await fetcher();
      await this._put(k, result, expireSeconds);
    const end = performance.now();
    this.recordMetric(namespace, [
      [MetricIndex.MissCount, 1],
      [MetricIndex.MissTime, end - start]], end);
    return result;
  }

  async put(namespace: string, key: string, value: unknown, expireSeconds = 0) {
    const k = `${namespace}:${key}`;
    return this._put(k, value, expireSeconds);
  }

  async getTtl(namespace: string, key: string) {
    const k = `${namespace}:${key}`;
    return await this.redisClient.ttl(k);
  }

  private recordMetric(namespace: string, values: [MetricIndex, number][], now: number) {
    let counters = this.counters.get(namespace);
    if (!counters) {
      counters = [0, 0, 0, 0];
      this.counters.set(namespace, counters);
    }
    for (const [index, value] of values) {
      counters[index] += value;
    }
    if (now > this.lastFlush + FLUSH_INTERVAL) {
      this.flushMetrics();
    }
  }

  private flushMetrics() {
    const now = performance.now();
    const timestamp = Math.floor(Date.now() - now + this.lastFlush);
    for (const [cache_namespace, metrics] of this.counters) {
      const labels = { cache_namespace };
      if (metrics[MetricIndex.HitCount] !== 0) {
        this.metricsClient.record('HitCount', labels, metrics[MetricIndex.HitCount], timestamp);
        metrics[MetricIndex.HitCount] = 0;
      }
      if (metrics[MetricIndex.HitTime] !== 0) {
        this.metricsClient.record('HitTime', labels, metrics[MetricIndex.HitTime], timestamp);
        metrics[MetricIndex.HitTime] = 0;
      }
      if (metrics[MetricIndex.MissCount] !== 0) {
        this.metricsClient.record('MissCount', labels, metrics[MetricIndex.MissCount], timestamp);
        metrics[MetricIndex.MissCount] = 0;
      }
      if (metrics[MetricIndex.MissTime] !== 0) {
        this.metricsClient.record('MissTime', labels, metrics[MetricIndex.MissTime], timestamp);
        metrics[MetricIndex.MissTime] = 0;
      }
    }
    this.lastFlush = now;
  }

  private async _put(k: string, value: unknown, expireSeconds = 0) {
    if (expireSeconds) {
      return await this.redisClient.set(
        k,
        Buffer.from(encode(value)),
        "EX",
        expireSeconds,
      );
    }

    await this.redisClient.set(k, Buffer.from(encode(value)));
  }
}
