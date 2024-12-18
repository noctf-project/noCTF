import { createClient } from "redis";
import { Logger } from "../types/primitives.ts";

export class RedisClientFactory {
  private readonly url;
  private readonly logger;
  private client: ReturnType<typeof createClient>;

  constructor(url: string, logger?: Logger) {
    this.url = url;
    this.logger = logger;
  }

  async getClient(): Promise<ReturnType<typeof createClient>> {
    if (this.client) {
      return this.client;
    }
    if (this.logger) {
      const url = new URL(this.url);
      this.logger.info(
        `Connecting to redis at ${url.host}:${url.port || 6379}`,
      );
    }
    this.client = await createClient({
      url: this.url,
    }).connect();
    return this.client;
  }
}
