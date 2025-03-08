import { decode, encode } from "cbor2";
import type { ServiceCradle } from "../index.ts";
import { Compress, Decompress } from "../util/message_compression.ts";

type LoadParams = {
  expireSeconds: number;
  forceFetch: boolean;
};
export type LoadOptions = Partial<LoadParams>;
const DEFAULT_LOAD_PARAMS: LoadParams = {
  expireSeconds: 30,
  forceFetch: false,
};

type Props = Pick<ServiceCradle, "redisClientFactory" | "metricsClient">;

export class CacheService {
  private readonly redisClient;
  private readonly metricsClient;
  private readonly coalesceMap = new Map<
    string,
    Promise<Uint8Array<ArrayBufferLike> | null>
  >();

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
    const { expireSeconds, forceFetch } = {
      ...DEFAULT_LOAD_PARAMS,
      ...options,
    };
    const k = `${namespace}:${key}`;
    if (!forceFetch) {
      const data = (await this._get(k)) as T;
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
    let promise = this.coalesceMap.get(k);
    if (!promise) {
      promise = this._getRaw(k).finally(() => this.coalesceMap.delete(k));
      this.coalesceMap.set(k, promise);
    }
    const data = await promise;
    if (!data) return null;
    return decode(data);
  }

  private async _getRaw(k: string) {
    const client = await this.redisClient;
    const data = await client.get(
      client.commandOptions({ returnBuffers: true }),
      k,
    );
    if (!data) return null;
    return await Decompress(data);
  }

  async put<T>(
    namespace: string,
    key: string,
    value: T,
    expireSeconds?: number,
  ) {
    const k = `${namespace}:${key}`;
    return this._put(k, value, expireSeconds);
  }

  async del(namespace: string, key: string | string[]) {
    const client = await this.redisClient;
    const keys = Array.isArray(key)
      ? key.map((k) => `${namespace}:${k}`)
      : [`${namespace}:${key}`];
    const res = await client.del(keys);
    for (const key of keys) {
      this.coalesceMap.delete(key);
    }
    return res;
  }

  async getTtl(namespace: string, key: string) {
    const k = `${namespace}:${key}`;
    const client = await this.redisClient;
    return client.ttl(k);
  }

  private async _put(k: string, value: unknown, expireSeconds?: number) {
    if (value === null) return;
    const client = await this.redisClient;
    const b = await Compress(encode(value));
    const res = await client.set(
      k,
      Buffer.from(b.buffer, b.byteOffset, b.byteLength),
      {
        EX: expireSeconds,
      },
    );
    this.coalesceMap.delete(k);
    return res;
  }
}
