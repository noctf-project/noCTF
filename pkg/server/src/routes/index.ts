import { FastifyInstance } from 'fastify';
import swagger from 'fastify-swagger';
import { DOCS_ENABLED } from '../config';
import authRoutes from './auth';
import challengeRoutes from './challenge';

const apiRegister = async (fastify: FastifyInstance) => {
  fastify.register(swagger, {
    routePrefix: '/docs',
    exposeRoute: DOCS_ENABLED,
    uiConfig: {
      validatorUrl: null,
    },
    openapi: {
      info: {
        title: 'NoCTF',
        description: 'NoCTF API',
        version: '0.1.0',
      },
      externalDocs: {
        url: 'https://github.com/DownUnderCTF/noCTF',
        description: 'Repository',
      },
      tags: [
        { name: 'auth', description: 'Authentication and Session' },
      ],
      security: [
        { bearerAuth: [] },
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'jwt',
          },
        },
      },
    },
  });

  fastify.register(challengeRoutes, { prefix: '/challenge' });
  fastify.register(authRoutes);
};

export default async function register(fastify: FastifyInstance) {
  fastify.register(apiRegister, { prefix: '/api' });
}
