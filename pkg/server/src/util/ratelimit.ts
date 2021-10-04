import { FastifyRequest } from 'fastify';
import { Address6 } from 'ip-address';

const IP6_PREFIX = 16;

export const ipKeyGenerator = (request: FastifyRequest) => {
  const ip = (request.headers['x-real-ip']?.toString()
  || request.headers['x-forwarded-for']?.toString()
  || request.ip);

  let key = ip;
  try {
    const v6 = new Address6(ip);
    key = v6.canonicalForm().replace(/:/g, '').slice(0, IP6_PREFIX);
  } catch (e) {
    // fallback to key
  }
  return `i${key}`;
};

export const userKeyGenerator = (request: FastifyRequest) => (
  request.auth ? `rl_u${request.auth.uid}` : ipKeyGenerator(request)
);
