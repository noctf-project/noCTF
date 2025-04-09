import type { ServiceCradle } from "../index.ts";
import { nanoid } from "nanoid";
import { ErrorReply } from "redis";

type Props = Pick<ServiceCradle, "redisClientFactory" | "logger">;

const LEASE_PREFIX = "lease";

const SCRIPTS: Record<string, string> = {
  renew:
    'local val = redis.call("GET", KEYS[1]);' +
    'if val == ARGV[1] then redis.call("EXPIRE", KEYS[1], ARGV[2]);return 1;' +
    "else return 0 end",
};

export class LockServiceError extends Error {}

export class LockService {
  private readonly redisClientFactory;
  private readonly logger;

  private readonly scriptCache: Map<string, string> = new Map();

  constructor({ redisClientFactory, logger }: Props) {
    this.redisClientFactory = redisClientFactory;
    this.logger = logger;
  }

  async withLease<T>(
    name: string,
    handler: () => Promise<T>,
    durationSeconds = 10,
  ): Promise<T> {
    const token = await this.acquireLease(name, durationSeconds);
    let timeout = setInterval(
      async () => {
        try {
          await this.renewLease(name, token, durationSeconds);
        } catch (e) {
          this.logger.warn(e, "Could not renew lease on lock");
        }
      },
      (durationSeconds * 1000) / 3,
    );
    try {
      return await handler();
    } finally {
      clearTimeout(timeout);
      await this.dropLease(name, token);
    }
  }

  async acquireLease(name: string, durationSeconds = 10) {
    const token = nanoid();
    const client = await this.redisClientFactory.getClient();
    if (
      !(await client.set(`${LEASE_PREFIX}:${name}`, token, {
        EX: durationSeconds,
        NX: true,
      }))
    ) {
      throw new LockServiceError("lease already exists");
    }
    return token;
  }

  async renewLease(name: string, token: string, durationSeconds = 10) {
    if (
      !(await this.executeScript(
        "renew",
        [`${LEASE_PREFIX}:${name}`],
        [token, durationSeconds.toString()],
      ))
    ) {
      throw new LockServiceError("lease token mismatch");
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
    let sha = this.scriptCache.get(name);
    if (!sha) {
      sha = await client.scriptLoad(SCRIPTS[name]);
      this.scriptCache.set(name, sha);
    }
    try {
      return await client.evalSha(sha, {
        keys,
        arguments: args,
      });
    } catch (e) {
      if (e instanceof ErrorReply && e.message.startsWith("NOSCRIPT")) {
        this.scriptCache.set(name, await client.scriptLoad(SCRIPTS[name]));
        return await client.evalSha(sha, {
          keys,
          arguments: args,
        });
      } else {
        throw e;
      }
    }
  }
}
