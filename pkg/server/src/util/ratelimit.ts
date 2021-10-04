import { FastifyRequest } from "fastify";

export const ipKeyGenerator = (request: FastifyRequest) => (
  /* eslint-disable prefer-template */
  'rl_i' + (request.headers['x-real-ip']?.toString()
  || request.headers['x-forwarded-for']?.toString()
  || request.ip)
);

export const userKeyGenerator = (request: FastifyRequest) => (
  request.auth ? `rl_u${request.auth.uid}` : ipKeyGenerator(request)
);