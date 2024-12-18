import { decode, encode } from "cbor2";
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
  MissTime = 3,
}

export class CacheService {
  private readonly redisClient;
  private readonly metricsClient;

  constructor({ redisClientFactory, metricsClient }: Props) {
    this.redisClient = redisClientFactory.getClient();
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
    const client = await this.redisClient;
    const data = await client.get(client.commandOptions({ returnBuffers: true }), k);
    if (data) {
      const d = decode(data) as T;
      const end = performance.now();
      this.metricsClient.recordAggregate(
        [
          ["HitCount", 1],
          ["HitTime", end - start],
        ],
        { cache_namespace: namespace },
      );
      return d;
    }
    const result = await fetcher();
    await this._put(k, result, expireSeconds);
    const end = performance.now();
    this.metricsClient.recordAggregate(
      [
        ["MissCount", 1],
        ["MissTime", end - start],
      ],
      { cache_namespace: namespace },
    );
    return result;
  }

  async put(namespace: string, key: string, value: unknown, expireSeconds = 0) {
    const k = `${namespace}:${key}`;
    return this._put(k, value, expireSeconds);
  }

  async del(namespace: string, key: string) {
    const k = `${namespace}:${key}`;
    const client = await this.redisClient;
    return client.del(k);
  }

  async getTtl(namespace: string, key: string) {
    const k = `${namespace}:${key}`;
    const client = await this.redisClient;
    return client.ttl(k);
  }

  private async _put(k: string, value: unknown, expireSeconds = 0) {
    const client = await this.redisClient;
    return await client.set(
      k,
      Buffer.from(encode(value)),
      {
        EX: expireSeconds
      }
    );
  }
}
