import { FastifyInstance } from 'fastify';
import { createHash, randomBytes } from 'crypto';
import {
  AuthLoginRequest, AuthLoginRequestType, AuthRegisterCheckRequest,
  AuthRegisterCheckRequestType, AuthRegisterRequest, AuthRegisterRequestType,
  AuthVerifyRequest, AuthVerifyRequestType,
} from '../../schemas/requests';
import {
  AuthJWKSResponse, AuthJWKSResponseType, AuthLoginResponse, AuthLoginResponseType,
  AuthPermissionsResponse, AuthPermissionsResponseType, AuthRegisterCheckResponse,
  AuthRegisterCheckResponseType, AuthRegisterResponse, AuthRegisterResponseType,
  AuthVerifyResponse, AuthVerifyResponseType, DefaultResponse, DefaultResponseType,
} from '../../schemas/responses';
import services from '../../services';
import { ipKeyGenerator } from '../../util/ratelimit';
import { TOKEN_EXPIRY } from '../../config';
import UserDAO from '../../models/User';
import RoleDAO from '../../models/Role';

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
        await UserDAO.getByEmail(request.body.email);
        const refresh = (await randomBytes(48)).toString('base64url');
        const sid = createHash('sha256').update(refresh).digest();
        reply.send({
          access_token: await services.authToken.generate(0, 1, [], sid),
          refresh_token: refresh,
          expires: TOKEN_EXPIRY,
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
        const user = await UserDAO.create(request.body);
        const { token } = await UserDAO.generateVerify(user.id);
        request.log.info(`created user: verification token ${token}`);
        reply.code(200).send({});
      },
    },
  );

  fastify.post<{
    Body: AuthRegisterCheckRequestType,
    Reply: AuthRegisterCheckResponseType
  }>(
    '/register/check',
    {
      schema: {
        tags: ['auth'],
        security: [],
        body: AuthRegisterCheckRequest,
        response: {
          default: AuthRegisterCheckResponse,
        },
      },
      config: {
        permission: 'auth.public.register',
        rateLimit: {
          max: 30,
          keyGenerator: ipKeyGenerator,
        },
      },
      handler: async (request, reply) => {
        if (request.body.email && request.body.name) {
          reply.code(400).send({
            error: 'Either email or name must be provided, but not both',
          });
          return;
        }

        if (request.body.email) {
          reply.code(200).send({ exists: !!(await UserDAO.getIDByEmail(request.body.email)) });
          return;
        } if (request.body.name) {
          reply.code(200).send({ exists: !!(await UserDAO.getIDByName(request.body.name)) });
          return;
        }

        reply.code(400).send({
          error: 'Either email or name must be provided, but not both',
        });
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
        permission: 'auth.public.login',
        rateLimit: {
          max: 10,
          timeWindow: '1 minute',
          keyGenerator: ipKeyGenerator,
        },
      },
      handler: async (request, reply) => {
        const refresh = (await randomBytes(48)).toString('base64url');
        const sid = createHash('sha256').update(refresh).digest();
        reply.send({
          access_token: await services.authToken.generate(0, 1, [], sid),
          refresh_token: refresh,
          expires: TOKEN_EXPIRY,
        });
      },
    },
  );

  fastify.get<{ Reply: AuthPermissionsResponseType }>(
    '/permissions',
    {
      config: {
        permission: 'auth.self.permission',
      },
      schema: {
        tags: ['auth'],
        response: {
          default: AuthPermissionsResponse,
        },
      },
      handler: async (request, reply) => {
        if (!request.auth) {
          reply.code(200).send({
            permissions: await RoleDAO.getRolePermissionsByName('public'),
          });
          return;
        }
        reply.code(200).send({
          permissions: await UserDAO.getPermissions(request.auth?.uid),
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
        if (request.auth) {
          services.authToken.revoke(request.auth.sid);
        }
        reply.code(200).send({});
      },
    },
  );
}
