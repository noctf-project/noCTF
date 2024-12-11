import { Redis, RedisOptions } from "ioredis";
import { Logger } from "../types/primitives.ts";

export class RedisClientFactory {
  private readonly url;
  private readonly logger;

  constructor(url: string, logger?: Logger) {
    this.url = url;
    this.logger = logger;
  }

  createClient(options: RedisOptions={}) {
    const url = new URL(this.url);

    const client = new Redis({
      ...options,
      tls: url.protocol === 'rediss:' && {},
      host: url.host,
      username: url.username,
      password: url.password,
      port: parseInt(url.port) || 6379,
      db: parseInt(url.pathname.substring(1)) || 0
    });
    if (this.logger) {
      this.logger.info(`Connecting to redis at ${url.host}`);
    }
    return client;
  }
}