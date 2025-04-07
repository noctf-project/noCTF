import TTLCache from "@isaacs/ttlcache";
import { ServiceCradle } from "../index.ts";

type Props = Pick<ServiceCradle, "redisClientFactory" | "logger">;

const WRITE_INTERVAL_MS = 20;
const BUCKET_NAMESPACE = "core:rl:bucket";
const BLOCKED_NAMESPACE = "core:rl:blocked";

export class RateLimitService {
  // cache key
  // sample_window:key
  private reads = new Map<string, [number, number]>();
  private writes = new Map<string, number>();
  private timeout: ReturnType<typeof setTimeout> | null;

  private readonly blocked = new TTLCache({
    max: 4096,
    ttl: 60000,
  });
  private readonly redisClientFactory;
  private readonly logger;

  constructor({ redisClientFactory, logger }: Props) {
    this.redisClientFactory = redisClientFactory;
    this.logger = logger;
  }

  async check(
    key: string,
    {
      windowSeconds,
      limit: configured,
    }: {
      windowSeconds: number;
      limit: number;
    },
  ): Promise<number | null> {
    const k = `${windowSeconds}:${key}`;
    const blocked = this.blocked.getRemainingTTL(k);
    if (blocked) return blocked;
    if (!this.timeout)
      this.timeout = setTimeout(() => this._dump(), WRITE_INTERVAL_MS);
    if (!this.reads.has(k)) await this._read(k, windowSeconds);
    const now = Math.floor(Date.now() / 1000);
    const read = this.reads.get(k) || [0, 0];
    const write = this.writes.get(k) || 0;
    // assume constant rate of requests in prev window
    const limit =
      (read[0] * (windowSeconds - (now % windowSeconds))) / windowSeconds +
      read[1] +
      write +
      1;
    if (limit >= configured) {
      const diff = limit - configured;
      const ttl = Math.floor(
        Math.min(windowSeconds, Math.max(diff / limit, 0) * windowSeconds) *
          1000,
      );
      if (ttl > 0) {
        void this._block(k, ttl);
        return ttl;
      }
    }
    this.writes.set(k, write + 1);
    return null;
  }

  private async _block(fullKey: string, ttl: number) {
    this.blocked.set(fullKey, 1, { ttl });
    const client = await this.redisClientFactory.getClient();
    try {
      client.set(`${BLOCKED_NAMESPACE}:${fullKey}`, "", { PXAT: ttl });
    } catch (e) {
      this.logger.error(e, "Error writing rate limit block");
    }
  }

  private async _read(fullKey: string, windowSeconds: number) {
    const now = Math.floor(Date.now() / 1000);
    const window = Math.floor(now / windowSeconds) * windowSeconds;
    const prev = `${BUCKET_NAMESPACE}:${window - windowSeconds}:${fullKey}`;
    const curr = `${BUCKET_NAMESPACE}:${window}:${fullKey}`;
    const client = await this.redisClientFactory.getClient();
    const blocked = await client.pTTL(`${BLOCKED_NAMESPACE}:${fullKey}`);
    if (blocked > 0) {
      this.blocked.setTTL(fullKey, blocked);
      return;
    }
    const values = await client.mGet([prev, curr]);
    this.reads.set(fullKey, [+(values[0] || 0), +(values[1] || 0)]);
  }

  private async _dump() {
    if (this.timeout) {
      clearTimeout(this.timeout);
      this.timeout = null;
    }
    const client = await this.redisClientFactory.getClient();
    const writes = this.writes;
    this.writes = new Map();
    const multi = client.multi();
    const now = Math.floor(Date.now() / 1000);

    for (const [k, v] of writes) {
      const read = this.reads.get(k) || [0, 0];
      this.reads.set(k, [read[0], read[1] + v]);
      const sample = +k.substring(0, k.indexOf(":"));
      const current = Math.floor(now / sample) * sample;
      const key = `${BUCKET_NAMESPACE}:${current}:${k}`;
      multi.incrBy(key, v);
      multi.expireAt(key, current + sample * 2);
    }
    try {
      await multi.exec();
      this.reads.clear();
    } catch (e) {
      this.logger.error(e, "Error writing rate limit values");
    }
  }
}
