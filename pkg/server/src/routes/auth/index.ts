import { FastifyInstance } from 'fastify';
import services from '../../services';

export default async function register(fastify: FastifyInstance) {
  fastify.route({
    method: 'GET',
    url: '/jwt',
    handler: async (request, reply) => {
      reply.send({
        token: await services.authToken.generate('default', '1', '100'),
      });
    },
  });
}
