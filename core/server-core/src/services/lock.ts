import type { ServiceCradle } from "../index.ts";
import { nanoid } from "nanoid";
import { ErrorReply } from "redis";

type Props = Pick<ServiceCradle, "redisClientFactory">;

const LEASE_PREFIX = "lease";

const SCRIPTS: Record<string, string> = {
  renew:
    'local val = redis.call("GET", KEYS[1]);' +
    'if val == ARGV[1] then redis.call("EXPIRE", KEYS[1], ARGV[2]);return 1;' +
    "else return 0 end",
};

export class LockService {
  private readonly redisClientFactory;
  private readonly scriptCache: Map<string, string> = new Map();

  constructor({ redisClientFactory }: Props) {
    this.redisClientFactory = redisClientFactory;
  }

  async withLease<T>(
    name: string,
    handler: () => Promise<T>,
    durationSeconds = 60,
  ): Promise<T> {
    const token = await this.acquireLease(name, durationSeconds);
    try {
      return await handler();
    } finally {
      await this.dropLease(name, token);
    }
  }

  async acquireLease(name: string, durationSeconds = 60) {
    const token = nanoid();
    const client = await this.redisClientFactory.getClient();
    if (
      !(await client.set(`${LEASE_PREFIX}:${name}`, token, {
        EX: durationSeconds,
        NX: true,
      }))
    ) {
      throw new Error("lease already exists");
    }
    return token;
  }

  async renewLease(name: string, token: string, durationSeconds = 60) {
    if (
      !(await this.executeScript(
        "renew",
        [`${LEASE_PREFIX}:${name}`],
        [token, durationSeconds.toString()],
      ))
    ) {
      throw new Error("lease token mismatch");
    }
    return durationSeconds;
  }

  async dropLease(name: string, token?: string) {
    // force
    if (!token) {
      const client = await this.redisClientFactory.getClient();
      await client.del(`${LEASE_PREFIX}:${name}`);
      return;
    }
    return this.renewLease(name, token, 0);
  }

  private async executeScript(name: string, keys: string[], args: string[]) {
    const client = await this.redisClientFactory.getClient();
    if (!this.scriptCache.has(name)) {
      this.scriptCache.set(name, await client.scriptLoad(SCRIPTS[name]));
    }
    try {
      return await client.evalSha(this.scriptCache.get(name), {
        keys,
        arguments: args,
      });
    } catch (e) {
      if (e instanceof ErrorReply && e.message.startsWith("NOSCRIPT")) {
        this.scriptCache.set(name, await client.scriptLoad(SCRIPTS[name]));
        return await client.evalSha(this.scriptCache.get(name), {
          keys,
          arguments: args,
        });
      } else {
        throw e;
      }
    }
  }
}
