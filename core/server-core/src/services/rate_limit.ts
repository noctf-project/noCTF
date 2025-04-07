import TTLCache from "@isaacs/ttlcache";
import { ServiceCradle } from "../index.ts";

type Props = Pick<ServiceCradle, "redisClientFactory" | "logger">;

const FLUSH_INTERVAL_MS = 10;
const BUCKET_NAMESPACE = "core:rl:bucket";

export type RateLimitBucket = {
  key: string;
  windowSeconds: number;
  limit: number;
};

export class RateLimitService {
  // cache key
  // sample_window:key
  private writes = new Map<string, number>();
  private timeout: ReturnType<typeof setTimeout> | null;
  private fetchLocks = new Map<string, Promise<void>>();

  private readonly reads = new Map<string, [number, number]>();
  private readonly blocked = new TTLCache({
    max: 8192,
    ttl: 60000,
  });

  private readonly redisClientFactory;
  private readonly logger;

  constructor({ redisClientFactory, logger }: Props) {
    this.redisClientFactory = redisClientFactory;
    this.logger = logger;
  }

  async evaluate(input: RateLimitBucket[]): Promise<number | null> {
    if (!this.timeout) {
      this.timeout = setTimeout(() => this._dump(), FLUSH_INTERVAL_MS);
    }
    const now = Math.floor(Date.now() / 1000);
    const buckets: RateLimitBucket[] = input.map(
      ({ key, windowSeconds, limit }) => ({
        key: `${windowSeconds}:${key}`,
        windowSeconds,
        limit,
      }),
    );
    let maxBlocked = 0;
    for (const { key } of buckets) {
      const blocked = this.blocked.getRemainingTTL(key);
      if (blocked) maxBlocked = Math.max(maxBlocked, blocked);
    }
    if (maxBlocked) return now + maxBlocked;

    const data = await this._read(now, buckets);

    maxBlocked = 0;
    for (const [i, { key, windowSeconds, limit }] of buckets.entries()) {
      const read = data[i];
      const write = this.writes.get(key) || 0;
      // assume constant rate of requests in prev window
      // the request rate is equal number of requests in the current minute
      // plus an interpolated number of requests in the last minute using
      // linear decay (i.e. if we have 60 requests per min)
      const estimate =
        (read[0] * (windowSeconds - (now % windowSeconds))) / windowSeconds +
        read[1] +
        write +
        1;
      if (estimate >= limit) {
        const diff = estimate - limit;
        const ttl = Math.floor(
          Math.min(
            windowSeconds,
            Math.max(diff / estimate, 0) * windowSeconds,
          ) * 1000,
        );
        if (ttl > 0) {
          this.blocked.set(key, 1, { ttl });
          maxBlocked = Math.max(maxBlocked, ttl);
        }
      }
    }
    if (maxBlocked) return now + maxBlocked;
    for (const { key } of buckets) {
      this.writes.set(key, (this.writes.get(key) || 0) + 1);
    }

    return null;
  }

  private async _read(
    now: number,
    buckets: RateLimitBucket[],
  ): Promise<[number, number][]> {
    const client = await this.redisClientFactory.getClient();

    const fetched: ([number, number] | undefined)[] = buckets.map((x) =>
      this.reads.get(x.key),
    );

    const locks = new Set<Promise<void>>();
    const fetchVals: string[] = [];
    const lockedKeys: number[] = [];
    const fetchKeys: [number, string][] = [];
    for (const [i, res] of fetched.entries()) {
      if (res) continue;
      const { windowSeconds, key } = buckets[i];
      const lock = this.fetchLocks.get(key);
      if (lock) {
        locks.add(lock);
        lockedKeys.push(i);
        continue;
      }
      const window = Math.floor(now / windowSeconds) * windowSeconds;
      const prev = `${BUCKET_NAMESPACE}:${window - windowSeconds}:${key}`;
      const curr = `${BUCKET_NAMESPACE}:${window}:${key}`;
      fetchVals.push(prev, curr);
      fetchKeys.push([i, key]);
    }
    if (!fetchVals.length && !lockedKeys.length)
      return fetched as [number, number][];

    const lock = Promise.withResolvers<void>();
    // can't have uncaught promises
    lock.promise.catch(() => {});
    fetchKeys.forEach(([_i, k]) => this.fetchLocks.set(k, lock.promise));
    try {
      const values = fetchVals.length ? await client.mGet(fetchVals) : [];
      await Promise.all([...locks]);
      lock.resolve();
      for (const [i, [j, key]] of fetchKeys.entries()) {
        const value: [number, number] = [
          +(values[i * 2] || 0),
          +(values[i * 2 + 1] || 0),
        ];
        fetched[j] = value;
        this.reads.set(key, value);
      }
      for (const i of lockedKeys) {
        fetched[i] = this.reads.get(buckets[i].key);
      }
      return fetched as [number, number][];
    } catch (e) {
      lock.reject(e);
      throw e;
    } finally {
      fetchKeys.forEach(([_i, x]) => this.fetchLocks.delete(x));
    }
  }

  private async _dump() {
    if (this.timeout) {
      clearTimeout(this.timeout);
      this.timeout = null;
    }

    if (!this.writes.size) {
      this.reads.clear();
      return;
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
      // merge writes back into map since we don't want to lose it
      for (const [key, v] of writes) {
        this.reads.get(key)![1] -= v; // since we previously set it
        this.writes.set(key, (this.writes.get(key) || 0) + v);
      }
    }
  }
}
