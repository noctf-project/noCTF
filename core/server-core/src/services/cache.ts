import { decode, encode } from "cbor2";
import type { ServiceCradle } from "../index.ts";
import { Compress, Decompress } from "../util/message_compression.ts";

type LoadParams = {
  expireSeconds: number;
};
export type LoadOptions = Partial<LoadParams>;
const DEFAULT_LOAD_PARAMS: LoadParams = {
  expireSeconds: 30,
};

type Props = Pick<ServiceCradle, "redisClientFactory" | "metricsClient">;

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
    options?: LoadOptions,
  ): Promise<T> {
    const start = performance.now();
    const { expireSeconds } = {
      ...DEFAULT_LOAD_PARAMS,
      ...options,
    };
    const k = `${namespace}:${key}`;
    const data = await this._get(k) as T;
    if (data) {
      const end = performance.now();
      this.metricsClient.recordAggregate(
        [
          ["HitCount", 1],
          ["HitTime", end - start],
        ],
        { cache_namespace: namespace },
      );
      return data;
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

  async get<T>(namespace: string, key: string): Promise<T> {
    const k = `${namespace}:${key}`;
    return this._get(k) as T;
  }

  private async _get(k: string) {
    const client = await this.redisClient;
    const data = await client.get(
      client.commandOptions({ returnBuffers: true }),
      k,
    );
    if (!data) return null;
    return decode(await Decompress(data));
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
    if (value === null) return;
    const client = await this.redisClient;
    const b = await Compress(encode(value));
    return await client.set(k, Buffer.from(b.buffer, b.byteOffset, b.byteLength), {
      EX: expireSeconds,
    });
  }
}
