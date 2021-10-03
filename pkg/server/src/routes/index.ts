import { FastifyInstance } from 'fastify';
import authRoutes from './auth';

const apiRegister = async (fastify: FastifyInstance) => {
  fastify.register(authRoutes, { prefix: '/auth' });
};

export default async function register(fastify: FastifyInstance) {
  fastify.register(apiRegister, { prefix: '/api' });
}
