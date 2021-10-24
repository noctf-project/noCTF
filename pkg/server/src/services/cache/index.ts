import cbor from 'cbor';
import LRUCache from 'lru-cache';
import IORedis, { Redis } from 'ioredis';
import MetricsService from '../metrics';
import logger from '../../util/logger';

const DEFAULT_TTL = 600;
const KEY_SIMPLE_PREFIX = 'noctf_';
const CACHE_MAX_SIZE = 512 * 1024 * 1024;
const CHAN_INVALIDATE = '__redis__:invalidate';

export default class CacheService {
  private localCache = new LRUCache<string, string>(CACHE_MAX_SIZE);

  private primary: Redis;

  private secondary: Redis;

  constructor(url: string, private metrics: MetricsService) {
    this.primary = new IORedis(url, { keyPrefix: KEY_SIMPLE_PREFIX });
    this.secondary = new IORedis(url);
    // this.primary.on('ready', async () => this.setupPubSub());
  }

  async computeIfAbsent(key: string, compute: () => any, remoteTTL = DEFAULT_TTL, localTTL = 0) {
    const value = await this.get(key);
    if (value) {
      return value;
    }

    this.metrics.record('cache', { type: 'miss' }, 1);
    const callOut = await compute();
    if (callOut) {
      await this.set(
        key,
        callOut,
        remoteTTL,
        localTTL,
      );
    }
    return callOut;
  }

  async getRaw(key: string, localTTL = 0) {
    if (localTTL !== 0) {
      const value = this.localCache.get(key);
      if (value) {
        this.metrics.record('cache', { type: 'local' }, 1);
        return cbor.decode(value);
      }
    }

    const res = await this.primary.get(key);
    if (res) {
      this.metrics.record('cache', { type: 'redis' }, 1);
      if (localTTL !== 0) {
        this.localCache.set(key, res, localTTL * 1000);
      }
      const bin = Buffer.from(res, 'binary');
      return bin;
    }
  }

  async setRaw(key: string, value: string, remoteTTL = DEFAULT_TTL, localTTL = 0) {
    if (remoteTTL) {
      return this.primary.setex(key, remoteTTL, value);
    }
    if (localTTL) {
      this.localCache.set(key, value, localTTL * 1000);
    }
    return this.primary.set(key, value);
  }

  async get(key: string, localTTL = 0) {
    const bin = await this.getRaw(key, localTTL);
    if (bin) {
      return cbor.decode(Buffer.from(bin, 'binary'));
    }
  }

  async set(key: string, value: any, remoteTTL = DEFAULT_TTL, localTTL = 0) {
    const bin = cbor.encode(value).toString('binary');
    return this.setRaw(key, bin, remoteTTL, localTTL);
  }

  async purge(...keys: string[]) {
    keys.map((key) => this.localCache.del(key));
    return this.primary.del(...keys);
  }

  private async setupPubSub() {
    const secondaryId = await this.secondary.send_command('CLIENT', ['ID']);
    // setup client side caching
    await this.secondary.subscribe(CHAN_INVALIDATE);
    this.secondary.on('message', async (chan, message) => {
      switch (chan) {
        case CHAN_INVALIDATE:
          this.invalidateLocal(message);
          break;
        default:
          logger.warn('invalid redis subscription', { chan });
          break;
      }
    });
    const result = await this.primary
      .send_command('CLIENT', ['TRACKING', 'ON', 'REDIRECT', secondaryId, 'NOLOOP']);
    logger.info('set up pubsub and invalidation');
    if (result !== 'OK') {
      throw new Error('failed to setup pubsub');
    }
  }

  private invalidateLocal(key: string) {
    this.metrics.record('cache', { type: 'srvdel' }, 1);
    this.localCache.del(key);
  }

  async close() {
    logger.info('terminating redis connections');
    this.primary.disconnect();
    this.secondary.disconnect();
  }
}
