import fastify, { FastifyInstance } from 'fastify';
import { fastifyRequestContextPlugin } from 'fastify-request-context';
import { nanoid } from 'nanoid';
import fastifyRateLimit from 'fastify-rate-limit';
import Routes from './routes';
import { NODE_ENV } from './config';
import logger from './util/logger';
import { ERROR_INTERNAL_SERVER_ERROR } from './util/constants';
import pbacHook from './hooks/pbac';
import { clientUserKeyGenerator } from './util/ratelimit';
import authHook from './hooks/auth';

let server: FastifyInstance;

export const init = async () => {
  if (server) return server;
  server = fastify({
    logger,
    trustProxy: true,
    genReqId: (req) => req.headers['x-request-id'] as string || nanoid(),
  });

  server.register(fastifyRequestContextPlugin, {
    hook: 'preValidation',
    defaultStoreValues: {},
  });

  server.setErrorHandler(async (error, request, reply) => {
    if (error.validation) {
      reply.status(400).send({ error: error.message });
      return;
    }
    if (error.statusCode) {
      reply.status(error.statusCode).send({ error: error.message });
      return;
    }

    request.log.error(error);

    reply.status(500).send({
      error: ERROR_INTERNAL_SERVER_ERROR,
      trace: NODE_ENV === 'development' ? error.stack : undefined,
    });
  });

  // Mount auth hook
  server.decorateRequest('auth', null);
  server.addHook('onRequest', authHook);
  server.addHook('onRequest', pbacHook);

  // Mount rate limiting hook
  server.register(fastifyRateLimit, {
    max: 80,
    timeWindow: '1 minute',
    keyGenerator: clientUserKeyGenerator,
  });

  server.register(Routes);
  return server;
};
