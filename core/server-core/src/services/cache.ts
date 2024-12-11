import { RedisUrlType } from "../clients/redis_factory.ts";
import { ServiceCradle } from "../index.ts";

type Data = string | number | Buffer;
type LoadParams<T> = {
  expireSeconds: number;
  serializer: (d: T) => Data;
  deserializer: (d: Data) => T;
};
export type LoadOptions<T> = Partial<LoadParams<T>>;
const DEFAULT_LOAD_PARAMS: LoadParams<unknown> = {
  expireSeconds: 30,
  serializer: JSON.stringify,
  deserializer: JSON.parse,
};

type Props = Pick<ServiceCradle, "redisClientFactory">;

export class CacheService {
  private readonly redisClient;

  constructor({ redisClientFactory }: Props) {
    this.redisClient = redisClientFactory.createClient(RedisUrlType.Cache);
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
    const data = await this.redisClient.get(key);
    if (data) {
      return deserializer(data) as T;
    }
    const result = await fetcher();
    await this.put(key, serializer(result), expireSeconds);
    return result;
  }

  async put(key: string, value: Data, expireSeconds = 0) {
    if (expireSeconds) {
      return await this.redisClient.set(key, value, "EX", expireSeconds);
    }

    await this.redisClient.set(key, value);
  }

  async getTtl(key: string) {
    return await this.redisClient.ttl(key);
  }

  async ttl(key: string) {
    await this.redisClient.ttl(key);
  }
}
