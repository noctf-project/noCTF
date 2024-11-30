import { createClient } from "redis";

type Data = string | number | Buffer;
type LoadParams<T> = {
  expireSeconds: number;
  serializer: (d: T) => Data;
  deserializer: (d: Data) => T;
};
export type LoadOptions<T> = Partial<LoadParams<T>>;
const DEFAULT_LOAD_PARAMS: LoadParams<unknown> = {
  expireSeconds: 60,
  serializer: JSON.stringify,
  deserializer: JSON.parse,
};

export class CacheClient {
  private client;

  constructor(redisUrl: string) {
    this.client = createClient({
      url: redisUrl,
    });
  }

  async connect() {
    await this.client.connect();
  }

  async load<T>(
    key: string,
    fetcher: () => Promise<T>,
    options?: LoadOptions<T>,
  ): Promise<T> {
    const { serializer, deserializer, expireSeconds } = {
      ...DEFAULT_LOAD_PARAMS,
      ...options,
    };
    const data = await this.client.get(key);
    if (data) {
      return deserializer(data) as T;
    }
    const result = await fetcher();
    await this.put(key, serializer(result), expireSeconds);
    return result;
  }

  async put(key: string, value: Data, expireSeconds = 0) {
    await this.client.set(key, value, {
      EX: expireSeconds || null,
    });
  }

  async getTtl(key: string) {
    return await this.client.ttl(key);
  }

  async ttl(key: string) {
    await this.client.ttl(key);
  }
}
