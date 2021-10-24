import { HookHandlerDoneFunction } from 'fastify';
import { Redis } from 'ioredis';
import services from '../services';

const closeHook = (rateLimitRedis: Redis) => async (_: any, done: HookHandlerDoneFunction) => {
  await services.database.close();
  await services.cache.close();
  rateLimitRedis.disconnect();
  done();
};

export default closeHook;
