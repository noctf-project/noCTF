import { createClient, ErrorReply } from "redis";
import type { Logger } from "../types/primitives.ts";
import TTLCache from "@isaacs/ttlcache";

export class RedisClientFactory {
  private readonly url;
  private readonly logger;
  private client: ReturnType<typeof createClient>;

  private readonly scriptCache = new TTLCache<string, string>({
    max: 1000,
    ttl: Infinity,
  });

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

  async executeScript<T>(
    script: string,
    keys: string[],
    args: string[],
    returnBuffers = false,
  ): Promise<T> {
    const client = await this.getClient();
    let sha = this.scriptCache.get(script);
    if (!sha) {
      sha = await client.scriptLoad(script);
      this.scriptCache.set(script, sha);
    }
    const exec = (): Promise<T> => {
      if (returnBuffers) {
        return client.evalSha(client.commandOptions({ returnBuffers }), sha, {
          keys,
          arguments: args,
        }) as Promise<T>;
      }
      return client.evalSha(sha, {
        keys,
        arguments: args,
      }) as Promise<T>;
    };

    try {
      return await exec();
    } catch (e) {
      if (e instanceof ErrorReply && e.message.startsWith("NOSCRIPT")) {
        this.scriptCache.set(script, await client.scriptLoad(script));
        return await exec();
      } else {
        throw e;
      }
    }
  }
}
