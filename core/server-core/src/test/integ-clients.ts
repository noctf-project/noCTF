import { DatabaseClient, DBType } from "../clients/database.ts";
import { KeyService } from "../services/key.ts";
import { RedisClientFactory } from "../clients/redis.ts";
import { NATSClientFactory } from "../clients/nats.ts";
import type { Logger } from "../types/primitives.ts";

export const TEST_SECRET_KEY = "12345678901234567890123456789012";

const noopLogger: Logger = {
  info: () => {},
  warn: () => {},
  error: () => {},
  debug: () => {},
  trace: () => {},
  fatal: () => {},
  child: () => noopLogger,
};

export class TestClients {
  private dbClient?: DatabaseClient;
  private redisFactory?: RedisClientFactory;
  private natsFactory?: NATSClientFactory;
  public readonly keyService: KeyService;

  constructor(secretKey: string = TEST_SECRET_KEY) {
    this.keyService = new KeyService(secretKey);
  }

  getDbClient(): DatabaseClient {
    if (!this.dbClient) {
      const url = process.env.POSTGRES_URL;
      if (!url) {
        throw new Error("POSTGRES_URL is not set");
      }
      this.dbClient = new DatabaseClient(null, this.keyService, url);
    }
    return this.dbClient;
  }

  getDb(): DBType {
    return this.getDbClient().get();
  }

  getRedisFactory(): RedisClientFactory {
    if (!this.redisFactory) {
      const url = process.env.REDIS_URL;
      if (!url) {
        throw new Error("REDIS_URL is not set");
      }
      this.redisFactory = new RedisClientFactory(url, noopLogger);
    }
    return this.redisFactory;
  }

  getNATSFactory(): NATSClientFactory {
    if (!this.natsFactory) {
      const url = process.env.NATS_URL;
      if (!url) {
        throw new Error("NATS_URL is not set");
      }
      this.natsFactory = new NATSClientFactory(noopLogger, url);
    }
    return this.natsFactory;
  }

  async destroy(): Promise<void> {
    if (this.dbClient) {
      await this.dbClient.get().destroy();
      this.dbClient = undefined;
    }
    if (this.redisFactory) {
      try {
        const client = await this.redisFactory.getClient();
        await client.quit();
      } catch {
        // ignore if not connected
      }
      this.redisFactory = undefined;
    }
    if (this.natsFactory) {
      try {
        const client = await this.natsFactory.getClient();
        await client.close();
      } catch {
        // ignore if not connected
      }
      this.natsFactory = undefined;
    }
  }
}

export function createTestClients(secretKey?: string): TestClients {
  return new TestClients(secretKey);
}
