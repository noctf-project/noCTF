import type { ServiceCradle } from "../index.ts";
import { nanoid } from "nanoid";

type Props = Pick<ServiceCradle, "redisClientFactory" | "logger">;

const LEASE_PREFIX = "lease";

const SCRIPTS = {
  renew:
    'local val = redis.call("GET", KEYS[1]);' +
    'if val == ARGV[1] then redis.call("EXPIRE", KEYS[1], ARGV[2]);return 1;' +
    "else return 0 end",
};

export class LockServiceError extends Error {}

export type WithLeaseOptions = {
  leaseDurationSeconds?: number;
  renewIntervalSeconds?: number;
  maxFailedRenewAttempts?: number;
};

export class LockService {
  private readonly redisClientFactory;
  private readonly logger;

  constructor({ redisClientFactory, logger }: Props) {
    this.redisClientFactory = redisClientFactory;
    this.logger = logger;
  }

  async withLease<T>(
    name: string,
    handler: (signal: AbortSignal) => Promise<T>,
    options?: number | WithLeaseOptions,
  ): Promise<T> {
    const opts: WithLeaseOptions =
      typeof options === "number"
        ? { leaseDurationSeconds: options }
        : (options ?? {});

    const leaseDurationSeconds = opts.leaseDurationSeconds ?? 10;
    const renewIntervalSeconds =
      opts.renewIntervalSeconds ?? leaseDurationSeconds / 3;
    const maxFailedRenewAttempts = opts.maxFailedRenewAttempts ?? 2;

    const token = await this.acquireLease(name, leaseDurationSeconds);
    const controller = new AbortController();
    let consecutiveFailures = 0;

    const timeout = setInterval(async () => {
      try {
        await this.renewLease(name, token, leaseDurationSeconds);
        consecutiveFailures = 0;
      } catch (e) {
        if (e instanceof LockServiceError) {
          this.logger.error(
            e,
            "Lease token mismatch or lost, aborting immediately",
          );
          clearInterval(timeout);
          controller.abort(e);
          return;
        }

        consecutiveFailures++;
        this.logger.warn(e, "Could not renew lease on lock");
        if (consecutiveFailures >= maxFailedRenewAttempts) {
          clearInterval(timeout);
          controller.abort(new LockServiceError("Lost lease"));
        }
      }
    }, renewIntervalSeconds * 1000);
    try {
      return await handler(controller.signal);
    } finally {
      clearInterval(timeout);
      try {
        await this.dropLease(name, token);
      } catch (e) {
        this.logger.warn(e, "Could not drop lease on exit");
      }
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
      !(await this.redisClientFactory.executeScript(
        SCRIPTS.renew,
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
}
