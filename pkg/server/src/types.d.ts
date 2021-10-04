import { RateLimitOptions } from 'fastify-rate-limit';
import { AuthToken } from './util/types';

declare module 'fastify' {
  interface FastifyContextConfig {
    permission?: string;
    rateLimit?: RateLimitOptions;
  }

  interface FastifyRequest {
    auth?: AuthToken;
  }
}
