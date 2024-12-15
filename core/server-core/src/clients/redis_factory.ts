import { Redis, RedisOptions } from "ioredis";
import { Logger } from "../types/primitives.ts";

export enum RedisUrlType {
  Cache,
  Event,
}

export class RedisClientFactory {
  private readonly urls;
  private readonly logger;
  private readonly clients: Map<RedisUrlType, Redis> = new Map();

  constructor(urls: Record<RedisUrlType, string>, logger?: Logger) {
    this.urls = urls;
    this.logger = logger;
  }

  getSharedClient(type: RedisUrlType) {
    if (this.clients.has(type)) {
      return this.clients.get(type);
    }
    const client = this.createClient(type, { maxRetriesPerRequest: 0 });
    this.clients.set(type, client);
    return client;
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
