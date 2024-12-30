import type { Disposer, TTLOptions } from "@isaacs/ttlcache";
import TTLCache from "@isaacs/ttlcache";
import type { MetricsClient } from "../clients/metrics.ts";

export class LocalCache<K = unknown, V = unknown> {
  private readonly cache;

  constructor(opts?: TTLCache.Options<K, Promise<V>>) {
    this.cache = new TTLCache<K, V | Promise<V>>(opts);
  }

  async load(
    key: K,
    loader: () => V | Promise<V>,
    setTTL?: ((v: V) => TTLOptions | undefined) | TTLOptions | undefined,
  ): Promise<V> {
    let p = this.cache.get(key);
    if (typeof p === "undefined") {
      p = loader();
      this.cache.set(key, p);
    } else {
      return p;
    }
    try {
      const v = await p;
      this.cache.set(
        key,
        v,
        setTTL && (typeof setTTL === "function" ? setTTL(v) : setTTL),
      );
      return v;
    } catch (e) {
      this.cache.delete(key);
      throw e;
    }
  }

  static disposeMetricsHook<K, V>(
    metrics: MetricsClient,
    name: string,
  ): Disposer<K, V> {
    const labels = {
      local_cache: name,
    };
    return (_value, _key, reason) => {
      if (reason === "evict") {
        metrics.recordAggregate([["EvictedCount", 1]], labels);
      }
    };
  }
}
