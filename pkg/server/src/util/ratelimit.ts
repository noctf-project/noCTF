import { FastifyRequest } from 'fastify';
import { Address4, Address6 } from 'ip-address';

const IP6_PREFIX = 14;

export const ipKeyGenerator = (request: FastifyRequest) => {
  const ip = (request.headers['x-real-ip']?.toString()
  || request.headers['x-forwarded-for']?.toString()
  || request.ip);

  let key = `i{ip}`;

  // Convert ipv4 into more efficient hex
  try {
    const v4 = new Address4(ip);
    key = `d${v4.toHex().replace(/:/g, '')}`;
  } catch (e) {
    // fallback to key
  }

  try {
    const v6 = new Address6(ip);
    key = `f${v6.canonicalForm().replace(/:/g, '').slice(0, IP6_PREFIX)}`;
  } catch (e) {
    // fallback to key
  }

  return key;
};

export const userKeyGenerator = (request: FastifyRequest) => (
  request.auth ? `u${request.auth.uid}` : ipKeyGenerator(request)
);
