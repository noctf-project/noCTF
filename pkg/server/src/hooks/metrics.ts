import { onResponseAsyncHookHandler } from 'fastify';
import services from '../services';

const metricsHook: onResponseAsyncHookHandler<any, any, any> = async (request, reply) => {
  services.metrics.record(
    'http_request',
    {
      code: reply.statusCode.toString(),
      ...request.routerPath && { route: request.routerPath },
    },
    reply.getResponseTime().toFixed(1),
  );
};

export default metricsHook;
