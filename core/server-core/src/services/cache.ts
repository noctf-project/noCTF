import { Encoder } from "cbor-x";
import type { ServiceCradle } from "../index.ts";
import { Compress, Decompress } from "../util/message_compression.ts";
import { Stopwatch } from "../util/stopwatch.ts";
import { Coleascer } from "../util/coleascer.ts";

type LoadParams = {
  expireSeconds: number;
  forceFetch: boolean;
};
export type LoadOptions = Partial<LoadParams>;
const DEFAULT_LOAD_PARAMS: LoadParams = {
  expireSeconds: 30,
  forceFetch: false,
};

type Props = Pick<
  ServiceCradle,
  "redisClientFactory" | "metricsClient" | "logger"
>;

export class CacheService {
  private readonly logger;
  private readonly redisClient;
  private readonly metricsClient;

  private readonly getCoaleascer = new Coleascer();
  private readonly fetchColeascer = new Coleascer();

  private readonly encoder = new Encoder({ pack: true });

  constructor({ redisClientFactory, metricsClient, logger }: Props) {
    this.logger = logger;
    this.redisClient = redisClientFactory.getClient();
    this.metricsClient = metricsClient;
  }

  async load<T>(
    namespace: string,
    key: string,
    fetcher: () => Promise<T>,
    options?: LoadOptions,
  ): Promise<T> {
    const stopwatch = new Stopwatch();
    const { expireSeconds, forceFetch } = {
      ...DEFAULT_LOAD_PARAMS,
      ...options,
    };
    if (!forceFetch) {
      const data = (await this._get(namespace, key)) as T;
      if (data) {
        return data;
      }
    }
    const fullKey = `${namespace}:${key}`;
    return this.fetchColeascer.get(fullKey, () =>
      this._fetch(namespace, fullKey, expireSeconds, stopwatch, fetcher),
    );
  }

  async get<T>(namespace: string, key: string): Promise<T | null> {
    return this._get(namespace, key) as T;
  }

  private async _fetch<T>(
    namespace: string,
    fullKey: string,
    expireSeconds: number,
    stopwatch: Stopwatch,
    fetcher: () => Promise<T>,
  ) {
    const result = await fetcher();
    await this._put(fullKey, result, expireSeconds);
    this.metricsClient.recordAggregate(
      [
        ["MissCount", 1],
        ["MissTime", stopwatch.elapsed()],
      ],
      { cache_namespace: namespace },
    );
    return result;
  }

  private async _get(namespace: string, key: string) {
    const k = `${namespace}:${key}`;
    return this.getCoaleascer.get(k, () => this._getAndDecode(namespace, k));
  }

  private async _getAndDecode(namespace: string, fullKey: string) {
    const stopwatch = new Stopwatch();
    const client = await this.redisClient;
    const data = await client.get(
      client.commandOptions({ returnBuffers: true }),
      fullKey,
    );
    if (!data) return null;
    this.metricsClient.recordAggregate(
      [
        ["HitCount", 1],
        ["HitTime", stopwatch.elapsed()],
      ],
      { cache_namespace: namespace },
    );
    try {
      return this.encoder.decode(await Decompress(data));
    } catch (e) {
      this.logger.error(
        e,
        "Unable to decode cache value due to corruption, returning null",
      );
      return null;
    }
  }

  async put<T>(
    namespace: string,
    key: string,
    value: T,
    expireSeconds = DEFAULT_LOAD_PARAMS.expireSeconds,
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
      this.getCoaleascer.delete(key);
      this.fetchColeascer.delete(key);
    }
    return res;
  }

  async getTtl(namespace: string, key: string) {
    const k = `${namespace}:${key}`;
    const client = await this.redisClient;
    return client.ttl(k);
  }

  private async _put(fullKey: string, value: unknown, expireSeconds?: number) {
    if (value === null) return;
    const client = await this.redisClient;
    const b = await Compress(this.encoder.encode(value));
    const res = await client.set(
      fullKey,
      Buffer.from(b.buffer, b.byteOffset, b.byteLength),
      {
        EX: expireSeconds,
      },
    );
    this.getCoaleascer.delete(fullKey);
    this.fetchColeascer.delete(fullKey);
    return res;
  }
}
