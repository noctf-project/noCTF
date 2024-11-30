import { createClient } from "redis";

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

  async get<T>(key: string, getter: () => Promise<T>, expireSeconds = 60) {
    const data = await this.client.get(key);
    if (data) {
      return JSON.parse(data);
    }
    const result = await getter();
    await this.client.set(key, JSON.stringify(result), { EX: expireSeconds });
    return result;
  }

  async ttl(key: string) {
    await this.client.ttl(key);
  }
}
