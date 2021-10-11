import { FastifyInstance } from 'fastify';
import loginRoutes from './public';
import oauthRoutes from './oauth';
import sessionRoutes from './session';

export default async function register(fastify: FastifyInstance) {
  fastify.register(loginRoutes, { prefix: '/auth' });
  fastify.register(oauthRoutes, { prefix: '/auth/oauth2' });
  fastify.register(sessionRoutes, { prefix: '/auth' });
}
