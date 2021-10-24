import cbor from 'cbor';
import LRUCache from 'lru-cache';
import IORedis from 'ioredis';
import MetricsService from '../metrics';

const DEFAULT_TTL = 600;
const KEY_SIMPLE_PREFIX = 'noctf_';
const CACHE_MAX_SIZE = 512 * 1024 * 1024;

export default class CacheService extends IORedis {
  private localCache = new LRUCache<string, Buffer>(CACHE_MAX_SIZE);

  constructor(url: string, private metrics: MetricsService) {
    super(url, {
      keyPrefix: KEY_SIMPLE_PREFIX,
    });
  }

  async computeIfAbsent(key: string, compute: () => any, remoteTTL = DEFAULT_TTL, localTTL = 0) {
    if (localTTL !== 0) {
      const value = this.localCache.get(key);
      if (value) {
        this.metrics.record('cache', { type: 'local' }, 1);
        return cbor.decode(value);
      }
    }

    const res = await this.get(key);
    if (res) {
      this.metrics.record('cache', { type: 'redis' }, 1);
      const bin = Buffer.from(res, 'binary');
      const value = cbor.decode(bin);
      if (localTTL !== 0) {
        this.localCache.set(key, bin, localTTL * 1000);
      }
      return value;
    }

    this.metrics.record('cache', { type: 'miss' }, 1);
    const callOut = await compute();
    if (callOut) {
      const bin = cbor.encode(callOut);
      this.set(
        key,
        bin.toString('binary'),
        'ex',
        remoteTTL,
      );
      if (localTTL !== 0) {
        this.localCache.set(key, bin, localTTL * 1000);
      }
    }
    return callOut;
  }

  async purge(...keys: string[]) {
    keys.map((key) => this.localCache.del(key));
    await this.del(...keys);
  }

  async close() {
    this.disconnect();
  }
}
