import IORedis from 'ioredis';

const DEFAULT_TTL = 600;
const KEY_SIMPLE_PREFIX = 'noctf';

export default class CacheService extends IORedis {
  async computeIfAbsent(key: string, compute: () => any, remoteTTL = DEFAULT_TTL) {
    const fullKey = `${KEY_SIMPLE_PREFIX}_${key}`;
    const res = await this.get(fullKey);
    if (res) {
      return JSON.parse(res);
    }
    const callOut = await compute();
    if (callOut) this.set(fullKey, JSON.stringify(callOut), 'ex', remoteTTL);
    return callOut;
  }

  async purge(...keys: string[]) {
    this.del(...keys.map((key) => `${KEY_SIMPLE_PREFIX}_${key}`));
  }

  async close() {
    this.disconnect();
  }
}
