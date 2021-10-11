import fastify, { FastifyInstance, FastifyLoggerInstance } from 'fastify';
import { fastifyRequestContextPlugin } from 'fastify-request-context';
import { nanoid } from 'nanoid';
import fastifyRateLimit from 'fastify-rate-limit';
import { Http2Server, Http2ServerRequest, Http2ServerResponse } from 'http2';
import Routes from './routes';
import { NODE_ENV } from './config';
import logger from './util/logger';
import { ERROR_INTERNAL_SERVER_ERROR } from './util/constants';
import pbacHook from './hooks/pbac';
import { clientUserKeyGenerator } from './util/ratelimit';
import authHook from './hooks/auth';
import SecretRetriever from './util/secret_retriever';
import closeHook from './hooks/close';
import services from './services';
import { NoCTFHTTPException } from './util/exceptions';

export const init = async () => {
  const certSecret = new SecretRetriever('https', { watch: false });
  await certSecret.loaded;

  const server: FastifyInstance<
  Http2Server, Http2ServerRequest, Http2ServerResponse, FastifyLoggerInstance
  > = fastify({
    logger,
    http2: true,
    https: {
      allowHTTP1: true,
      key: certSecret.getValue('key.pem'),
      cert: certSecret.getValue('cert.pem'),
    },
    trustProxy: true,
    genReqId: (req) => req.headers['x-request-id'] as string || nanoid(),
  });

  server.register(fastifyRequestContextPlugin, {
    hook: 'preValidation',
    defaultStoreValues: {},
  });

  server.setErrorHandler(async (error, request, reply) => {
    if(error instanceof NoCTFHTTPException) {
      reply.status(error.statusCode).send({
        error: error.message,
        detail: error.detail
      });
      return;
    }

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
  server.addHook('onClose', closeHook);

  // Mount rate limiting hook
  server.register(fastifyRateLimit, {
    max: 90,
    timeWindow: '1 minute',
    keyGenerator: clientUserKeyGenerator,
    redis: services.cache,
  });

  server.register(Routes);
  return server;
};
