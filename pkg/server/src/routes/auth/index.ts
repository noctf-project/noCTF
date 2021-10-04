import { FastifyInstance } from 'fastify';
import { createHash } from 'crypto';
import {
  AuthLoginRequest, AuthLoginRequestType, AuthRegisterRequest, AuthRegisterRequestType,
  AuthVerifyRequest, AuthVerifyRequestType,
} from '../../schemas/requests';
import {
  AuthJWKSResponse, AuthJWKSResponseType, AuthLoginResponse, AuthLoginResponseType,
  AuthPermissionsResponse, AuthPermissionsResponseType, AuthRegisterResponse,
  AuthRegisterResponseType, AuthVerifyResponse, AuthVerifyResponseType,
  DefaultResponse, DefaultResponseType,
} from '../../schemas/responses';
import services from '../../services';
import { ipKeyGenerator } from '../../util/ratelimit';

export default async function register(fastify: FastifyInstance) {
  fastify.get<{ Reply: AuthJWKSResponseType }>(
    '/jwks',
    {
      schema: {
        tags: ['auth'],
        security: [],
        response: {
          default: AuthJWKSResponse,
        },
      },
      handler: async (request, reply) => {
        reply.send({
          keys: await services.authToken.getPublicJWKs(),
        });
      },
    },
  );

  fastify.post<{ Body: AuthLoginRequestType, Reply: AuthLoginResponseType }>(
    '/login',
    {
      schema: {
        tags: ['auth'],
        security: [],
        body: AuthLoginRequest,
        response: {
          default: AuthLoginResponse,
        },
      },
      config: {
        permission: 'auth.public.login',
        rateLimit: {
          max: 10,
          timeWindow: '1 minute',
          keyGenerator: ipKeyGenerator,
        },
      },
      handler: async (request, reply) => {
        const sid = createHash('sha256').update('100').digest();
        reply.send({
          token: await services.authToken.generate('default', [], '1', sid),
        });
      },
    },
  );

  fastify.post<{ Body: AuthRegisterRequestType, Reply: AuthRegisterResponseType }>(
    '/register',
    {
      schema: {
        tags: ['auth'],
        security: [],
        body: AuthRegisterRequest,
        response: {
          default: AuthRegisterResponse,
        },
      },
      config: {
        permission: 'auth.public.register',
        rateLimit: {
          max: 5,
          timeWindow: '1 minute',
          keyGenerator: ipKeyGenerator,
        },
      },
      handler: async (request, reply) => {
        reply.code(200).send({});
      },
    },
  );

  fastify.post<{ Body: AuthVerifyRequestType, Reply: AuthVerifyResponseType }>(
    '/verify',
    {
      schema: {
        tags: ['auth'],
        security: [],
        body: AuthVerifyRequest,
        response: {
          default: AuthVerifyResponse,
        },
      },
      config: {
        permission: 'auth.public.verify',
        rateLimit: {
          max: 5,
          timeWindow: '1 minute',
          keyGenerator: ipKeyGenerator,
        },
      },
      handler: async (request, reply) => {
        const sid = createHash('sha256').update('100').digest();
        reply.code(200).send({
          token: await services.authToken.generate('default', [], '1', sid),
        });
      },
    },
  );

  fastify.get<{ Reply: AuthPermissionsResponseType }>(
    '/permissions',
    {
      config: {
        permission: 'auth.self.session',
      },
      schema: {
        tags: ['auth'],
        response: {
          default: AuthPermissionsResponse,
        },
      },
      handler: async (request, reply) => {
        reply.code(200).send({
          permissions: [],
        });
      },
    },
  );

  fastify.post<{ Reply: DefaultResponseType }>(
    '/logout',
    {
      schema: {
        tags: ['auth'],
        response: {
          default: DefaultResponse,
        },
      },
      config: {
        permission: 'auth.self.session',
      },
      handler: async (request, reply) => {
        reply.code(200).send({});
      },
    },
  );
}
