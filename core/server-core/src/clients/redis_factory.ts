import { Redis, RedisOptions } from "ioredis";
import { Logger } from "../types/primitives.ts";

export enum RedisUrlType {
  Cache,
  Event,
}

export class RedisClientFactory {
  private readonly urls;
  private readonly logger;

  constructor(urls: Record<RedisUrlType, string>, logger?: Logger) {
    this.urls = urls;
    this.logger = logger;
  }

  createClient(type: RedisUrlType, options: RedisOptions = {}) {
    const url = new URL(this.urls[type]);

    const client = new Redis({
      ...options,
      tls: url.protocol === "rediss:" && {},
      host: url.host,
      username: url.username,
      password: url.password,
      port: parseInt(url.port) || 6379,
      db: parseInt(url.pathname.substring(1)) || 0,
    });
    if (this.logger) {
      this.logger.info(`Connecting to redis at ${url.host}`);
    }
    return client;
  }
}
