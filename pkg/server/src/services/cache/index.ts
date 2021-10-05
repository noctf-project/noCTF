import IORedis, { Redis } from 'ioredis';

export default class CacheService extends IORedis {
  constructor(url: string) {
    super(url);
  }
}
