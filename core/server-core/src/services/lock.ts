import { Redis } from "ioredis";
import { ServiceCradle } from "../index.ts";
import { RedisUrlType } from "../clients/redis_factory.ts";
import { nanoid } from "nanoid";

type Props = Pick<ServiceCradle, "redisClientFactory">;

const LOCK_PREFIX = "lock";
const LEASE_PREFIX = "lease";

export class LockService {
  private client: Redis & {
    svcLeaseRenew: (key: string, token: string, exp: number) => number;
  };

  constructor({ redisClientFactory }: Props) {
    this.client = redisClientFactory.getSharedClient(
      RedisUrlType.Event,
    ) as LockService["client"];
    this.client.defineCommand("svcLeaseRenew", {
      numberOfKeys: 1,
      lua:
        'local val = redis.call("GET", KEYS[1]);' +
        'if val == ARGV[1] then redis.call("EXPIRE", KEYS[1], ARGV[2]);return 1;' +
        "else return 0 end",
    });
  }

  async acquireLease(name: string, durationSeconds = 60) {
    const token = nanoid();
    if (
      !(await this.client.set(
        `${LEASE_PREFIX}:${name}`,
        token,
        "EX",
        durationSeconds,
        "NX",
      ))
    ) {
      throw new Error("lease already exists");
    }
    return token;
  }

  async renewLease(name: string, token: string, durationSeconds = 60) {
    if (
      !(await this.client.svcLeaseRenew(
        `${LEASE_PREFIX}:${name}`,
        token,
        durationSeconds,
      ))
    ) {
      throw new Error("lease token mismatch");
    }
    return durationSeconds;
  }

  async dropLease(name: string, token?: string) {
    // force
    if (!token) {
      await this.client.del(`${LEASE_PREFIX}:${name}`);
      return;
    }
    return this.renewLease(name, token, 0);
  }
}
