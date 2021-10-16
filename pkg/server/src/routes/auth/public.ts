import { FastifyInstance } from 'fastify';
import {
  AuthLoginRequest, AuthLoginRequestType,
  AuthRegisterCheckRequest, AuthRegisterCheckRequestType,
  AuthRegisterRequest, AuthRegisterRequestType,
  AuthResetRequest, AuthResetRequestType,
  AuthVerifyRequest, AuthVerifyRequestType,
} from '@noctf/schema/requests';
import {
  AuthLoginResponse, AuthLoginResponseType,
  AuthRegisterCheckResponse, AuthRegisterCheckResponseType,
  AuthRegisterResponse, AuthRegisterResponseType,
  AuthVerifyResponse, AuthVerifyResponseType,
  ErrorResponse, ErrorResponseType,
} from '@noctf/schema/responses';
import { ipKeyGenerator } from '../../util/ratelimit';
import { TOKEN_EXPIRY, VERIFY_EMAIL } from '../../config';
import { hash, verify } from '../../util/password';
import { createSession } from '../../util/session';
import UserDAO from '../../models/User';

export default async function register(fastify: FastifyInstance) {
  fastify.post<{
    Body: AuthLoginRequestType,
    Reply: ErrorResponseType | AuthLoginResponseType
  }>(
    '/login',
    {
      schema: {
        tags: ['auth'],
        security: [],
        body: AuthLoginRequest,
        response: {
          default: AuthLoginResponse,
          error: ErrorResponse,
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
        const user = await UserDAO.getByEmail(request.body.email);
        if (!user) {
          reply.code(401).send({
            error: 'invalid credentials',
          });
          return;
        }

        if (!user.password) {
          reply.code(401).send({
            error: 'account not activated',
          });
          return;
        }

        // Hash the password
        const password = await verify(user.password, request.body.password);
        if (!password) {
          reply.code(401).send({
            error: 'invalid credentials',
          });
          return;
        }
        if (user.banned) {
          reply.code(401).send({
            error: 'account has been banned',
          });
        }

        if (typeof password === 'string') {
          // hash upgrade
          await UserDAO.setPassword(user.id, password);
        }

        const { access, refresh } = await createSession(user.id, 0);
        reply.send({
          access_token: access,
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
        // TODO: email verification
        if (VERIFY_EMAIL) {
          reply.send({});
        } else {
          reply.send({ token });
        }
      },
    },
  );

  fastify.post<{
    Body: AuthRegisterCheckRequestType,
    Reply: ErrorResponseType | AuthRegisterCheckResponseType
  }>(
    '/register/check',
    {
      schema: {
        tags: ['auth'],
        security: [],
        body: AuthRegisterCheckRequest,
        response: {
          default: AuthRegisterCheckResponse,
          errror: ErrorResponse,
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
          reply.send({ exists: !!(await UserDAO.getIDByEmail(request.body.email)) });
          return;
        } if (request.body.name) {
          reply.send({ exists: !!(await UserDAO.getIDByName(request.body.name)) });
          return;
        }

        reply.code(400).send({
          error: 'Either email or name must be provided, but not both',
        });
      },
    },
  );

  fastify.post<{
    Body: AuthVerifyRequestType,
    Reply: ErrorResponseType | AuthVerifyResponseType
  }>(
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
        const id = await UserDAO.validateAndDiscardVerify(request.body.token);
        if (!id) {
          reply.code(401).send({
            error: 'Invalid verification token',
          });
          return;
        }

        // Hash the password
        const password = await hash(request.body.password);
        await UserDAO.setPassword(id, password);

        // Log the user in
        const { access, refresh } = await createSession(id, 0);
        reply.send({
          access_token: access,
          refresh_token: refresh,
          expires: TOKEN_EXPIRY,
        });
      },
    },
  );

  fastify.post<{ Body: AuthResetRequestType, Reply: ErrorResponseType }>(
    '/reset',
    {
      schema: {
        tags: ['auth'],
        security: [],
        body: AuthResetRequest,
        response: {
          default: ErrorResponse,
        },
      },
      config: {
        permission: 'auth.public.login',
        rateLimit: {
          max: 5,
          timeWindow: '1 minute',
          keyGenerator: ipKeyGenerator,
        },
      },
      handler: async (request, reply) => {
        const uid = await UserDAO.getIDByEmail(request.body.email);
        if (!uid) {
          request.log.debug({ email: request.body.email }, 'user with email does not exist');
          reply.send({});
          return;
        }

        // TODO: send token via email
        const { token } = await UserDAO.generateVerify(uid);
        request.log.info({ uid, token }, 'generated reset token');

        reply.send({});
      },
    },
  );
}
