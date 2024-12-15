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

type Props = Pick<ServiceCradle, "redisClientFactory">;

export class CacheService {
  private readonly redisClient;

  constructor({ redisClientFactory }: Props) {
    this.redisClient = redisClientFactory.getSharedClient(RedisUrlType.Cache);
  }

  async load<T>(
    key: string,
    fetcher: () => Promise<T>,
    options?: LoadOptions<T>,
  ): Promise<T> {
    const { expireSeconds } = {
      ...DEFAULT_LOAD_PARAMS,
      ...options,
    };
    const data = await this.redisClient.getBuffer(key);
    if (data) {
      return decode(data) as T;
    }
    const result = await fetcher();
    await this.put(key, result, expireSeconds);
    return result;
  }

  async put(key: string, value: unknown, expireSeconds = 0) {
    if (expireSeconds) {
      return await this.redisClient.set(
        key,
        Buffer.from(encode(value)),
        "EX",
        expireSeconds,
      );
    }

    await this.redisClient.set(key, Buffer.from(encode(value)));
  }

  async getTtl(key: string) {
    return await this.redisClient.ttl(key);
  }

  async ttl(key: string) {
    await this.redisClient.ttl(key);
  }
}
