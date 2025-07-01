import TTLCache from "@isaacs/ttlcache";
import { ServiceCradle } from "../index.ts";
import { RedisClientFactory } from "../clients/redis.ts";

type Props = Pick<ServiceCradle, "redisClientFactory" | "logger">;

const FLUSH_INTERVAL_MS = 0;
const BUCKET_NAMESPACE = "core:rl:bucket";

type ReadTuple = [number, number, number];
type WriteTuple = [number, number, number, number];

export type RateLimitBucket = {
  key: string;
  windowSeconds: number;
  limit: number;
};

const EmptyFn = () => {};
export class RateLimitService {
  // cache key
  // sample_window:key
  private writes = new Map<string, WriteTuple>();
  private timeout: ReturnType<typeof setTimeout> | null;
  private fetchLocks = new Map<string, Promise<ReadTuple>>();

  private readonly reads = new Map<string, ReadTuple>();
  private readonly blocked = new TTLCache({
    max: 10000,
    ttl: 60000,
  });

  private readonly redisClientFactory;
  private readonly logger;

  constructor({ redisClientFactory, logger }: Props) {
    this.redisClientFactory = redisClientFactory;
    this.logger = logger;
  }

  /**
   * Evaluate a rate limit request. If successful, then atomically increment all requested keys. If
   * unsuccessful, return the next eligible window without incrementing counters.
   *
   * @param input buckets
   * @returns null if successful or next eligible time
   */
  async evaluate(input: RateLimitBucket[]): Promise<number | null> {
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
    if (maxBlocked) {
      return maxBlocked;
    }

    const data = await this._read(now, buckets);
    // since it's after all the await points then we do the cleanup
    if (!this.timeout) {
      this.timeout = setTimeout(() => this._dump(), FLUSH_INTERVAL_MS);
    }

    maxBlocked = 0;
    for (const [i, { key, windowSeconds, limit }] of buckets.entries()) {
      const currentWindow = Math.floor(now / windowSeconds) * windowSeconds;
      const read = data[i];
      let write = this.writes.get(key);
      if (!write) {
        write = [currentWindow, 0, 0, 0];
        this.writes.set(key, write);
      }
      // assume constant rate of requests in prev window
      // the request rate is equal number of requests in the current minute
      // plus an interpolated number of requests in the last minute using
      // linear decay (i.e. if we have 60 requests per min)
      const [_, prev, current] = AddWritesToRead(read, write, windowSeconds);
      const estimate =
        (prev * (windowSeconds - (now % windowSeconds))) / windowSeconds +
        current;
      if (estimate >= limit) {
        const diff = estimate - limit;
        const ttl = Math.floor(
          Math.min(diff / prev, 1) *
            (windowSeconds - (now % windowSeconds)) *
            1000,
        );
        if (ttl > 0) {
          this.blocked.set(key, 1, { ttl });
          maxBlocked = Math.max(maxBlocked, ttl);
        }
      }
    }
    if (maxBlocked) return maxBlocked;
    for (const { key, windowSeconds } of buckets) {
      const currentWindow = Math.floor(now / windowSeconds) * windowSeconds;
      const write = this.writes.get(key)!; // this always exists since it's set above
      if (write[0] === currentWindow) write[2]++;
      else if (write[0] > currentWindow) write[3]++;
      else if (write[0] < currentWindow) write[1]++;
    }

    return null;
  }

  /**
   * Refund a rate limit increment. The assumption is that the refund is enacted on the same node
   * as the evaluation (monotonic time) so we should not hit a negative situation. If the sample
   * window has passed, then refund should no longer be possible. This method is not atomic across
   * different buckets.
   *
   * @param ts_ms timestamp of evaluate request
   * @param input buckets to refund
   */
  async refund(ts_ms: number, input: RateLimitBucket[]): Promise<void> {
    const buckets: RateLimitBucket[] = input.map(
      ({ key, windowSeconds, limit }) => ({
        key: `${windowSeconds}:${key}`,
        windowSeconds,
        limit,
      }),
    );
    for (const { key, windowSeconds } of buckets) {
      const refundWindow =
        Math.floor(ts_ms / (1000 * windowSeconds)) * windowSeconds;
      // We only want to refund if it's in the
      let write = this.writes.get(key);
      if (!write) {
        const currentWindow =
          Math.floor(Date.now() / (1000 * windowSeconds)) * windowSeconds;
        write = [currentWindow, 0, 0, 0];
        this.writes.set(key, write);
      }
      if (refundWindow === write[0]) write[2]--;
      else if (refundWindow === write[0] - windowSeconds) write[1]--;
      else if (refundWindow === write[0] + windowSeconds) write[3]--;
    }
    if (!this.timeout) {
      this.timeout = setTimeout(() => this._dump(), FLUSH_INTERVAL_MS);
    }
  }

  private async _read(
    now: number,
    buckets: RateLimitBucket[],
  ): Promise<ReadTuple[]> {
    const client = await this.redisClientFactory.getClient();

    const fetched: (ReadTuple | undefined)[] = buckets.map((x) =>
      this.reads.get(x.key),
    );
    const fetchVals: string[] = [];
    const lockedKeys: [number, Promise<ReadTuple>][] = [];
    const fetchKeys: [number, string, number][] = [];
    for (const [i, res] of fetched.entries()) {
      const { windowSeconds, key } = buckets[i];
      const window = Math.floor(now / windowSeconds) * windowSeconds;
      if (res && res[0] === window) continue;
      const lock = this.fetchLocks.get(key);
      if (lock) {
        lockedKeys.push([i, lock]);
        continue;
      }
      const prev = `${BUCKET_NAMESPACE}:${window - windowSeconds}:${key}`;
      const curr = `${BUCKET_NAMESPACE}:${window}:${key}`;
      fetchVals.push(prev, curr);
      fetchKeys.push([i, key, window]);
    }
    if (!fetchVals.length && !lockedKeys.length) return fetched as ReadTuple[];

    const locks = fetchKeys.map(() => Promise.withResolvers<ReadTuple>());
    locks.forEach((l) => l.promise.catch(EmptyFn));
    fetchKeys.forEach(([_i, k], i) => this.fetchLocks.set(k, locks[i].promise));
    try {
      const values = fetchVals.length ? await client.mGet(fetchVals) : [];
      for (const [i, [j, key, window]] of fetchKeys.entries()) {
        const value: ReadTuple = [
          window,
          +(values[i * 2] || 0),
          +(values[i * 2 + 1] || 0),
        ];
        fetched[j] = value;
        this.reads.set(key, value);
        locks[i].resolve(value);
      }
      const lockValues = await Promise.all(lockedKeys.map(([_i, p]) => p));
      for (const [i, [j]] of lockedKeys.entries()) {
        fetched[j] = lockValues[i];
      }
      return fetched as ReadTuple[];
    } catch (e) {
      locks.forEach((lock) => lock.reject(e));
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
    const tmp = new Map<string, ReadTuple>();

    for (const [k, w] of writes) {
      const sample = +k.substring(0, k.indexOf(":"));
      const r = this.reads.get(k) || [w[0], 0, 0];
      tmp.set(k, r);
      this.reads.set(k, AddWritesToRead(r, w, sample));
      SetKey(multi, k, w[1], w[0] - sample, sample);
      SetKey(multi, k, w[2], w[0], sample);
      SetKey(multi, k, w[3], w[0] + sample, sample);
    }
    try {
      await multi.exec();
      this.reads.clear();
    } catch (e) {
      this.logger.error(e, "Error writing rate limit values");
      // merge writes back into map since we don't want to lose it
      for (const [k, v] of tmp.entries()) {
        this.reads.set(k, v);
      }
    }
  }
}

const AddWritesToRead = (
  r: ReadTuple,
  w: WriteTuple,
  sample: number,
): ReadTuple => {
  // my brain ain't working but there must be an easier way to do this
  if (r[0] === w[0]) return [r[0], r[1] + w[1], r[2] + w[2]];
  if (r[0] === w[0] - sample) return [r[0], r[1], r[2] + w[1]];
  if (r[0] === w[0] + sample) return [r[0], r[1] + w[2], r[2] + w[3]];
  if (r[0] === w[0] + 2 * sample) return [r[0], r[1] + w[3], r[2]];
  return [...r];
};

const SetKey = (
  multi: ReturnType<
    Awaited<ReturnType<RedisClientFactory["getClient"]>>["multi"]
  >,
  k: string,
  v: number,
  current: number,
  sample: number,
) => {
  if (v === 0) return;
  const ns = `${BUCKET_NAMESPACE}:${current}:${k}`;
  multi.incrBy(ns, v);
  multi.expireAt(ns, current + sample * 2);
};
