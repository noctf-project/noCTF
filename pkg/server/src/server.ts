import fastify, { FastifyInstance } from 'fastify';
import { fastifyRequestContextPlugin } from 'fastify-request-context';
import { nanoid } from 'nanoid';
import * as strings from './strings';
import Routes from './routes';
import { NODE_ENV } from './config';

export let server: FastifyInstance;

export const init = async () => {
  if (server) return server;

  server = fastify({
    logger: true,
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

    request.log.error(error);

    reply.status(500).send({
      error: strings.ERROR_INTERNAL_SERVER_ERROR,
      trace: NODE_ENV === 'development' ? error.stack : undefined,
    });
  });

  server.register(Routes);
  return server;
};
