import { HookHandlerDoneFunction } from 'fastify';
import services from '../services';

const closeHook = async (_: any, done: HookHandlerDoneFunction) => {
  await services.database.close();
  await services.cache.close();
  done();
};

export default closeHook;
