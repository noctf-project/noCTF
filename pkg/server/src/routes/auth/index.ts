import { FastifyInstance } from 'fastify';
import { createHash } from 'crypto';
import {
  AuthLoginRequest, AuthLoginRequestType,
  AuthTokenRequest, AuthTokenRequestType,
  AuthRegisterCheckRequest, AuthRegisterCheckRequestType,
  AuthRegisterRequest, AuthRegisterRequestType,
  AuthResetRequest, AuthResetRequestType,
  AuthVerifyRequest, AuthVerifyRequestType,
} from '../../schemas/auth/requests';
import {
  AuthJWKSResponse, AuthJWKSResponseType,
  AuthLoginResponse, AuthLoginResponseType,
  AuthPermissionsResponse, AuthPermissionsResponseType,
  AuthTokenResponse, AuthTokenResponseType,
  AuthRegisterCheckResponse, AuthRegisterCheckResponseType,
  AuthRegisterResponse, AuthRegisterResponseType,
  AuthVerifyResponse, AuthVerifyResponseType,
} from '../../schemas/auth/responses';
import services from '../../services';
import { ipKeyGenerator } from '../../util/ratelimit';
import { TOKEN_EXPIRY, VERIFY_EMAIL } from '../../config';
import UserDAO from '../../models/User';
import RoleDAO from '../../models/Role';
import UserSessionDAO from '../../models/UserSession';
import { hash, verify } from '../../util/password';
import { now } from '../../util/helpers';
import { createSession } from '../../util/session';
import { ErrorResponse, ErrorResponseType } from '../../schemas/common';

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

        const { access, refresh } = await createSession(user.id);
        reply.send({
          access_token: access,
          refresh_token: refresh,
          expires: TOKEN_EXPIRY,
        });
      },
    },
  );

  fastify.post<{
    Body: AuthTokenRequestType,
    Reply: ErrorResponseType | AuthTokenResponseType
  }>(
    '/token',
    {
      schema: {
        tags: ['auth'],
        security: [],
        body: AuthTokenRequest,
        response: {
          default: AuthTokenResponse,
        },
      },
      config: {
        rateLimit: {
          max: 30,
          timeWindow: '1 minute',
          keyGenerator: ipKeyGenerator,
        },
      },
      handler: async (request, reply) => {
        if (request.body.grant_type !== 'refresh_token') {
          reply.code(501).send({
            error: 'only refresh_token is currently implemented',
          });
          return;
        }
        // TODO: support third party applications
        if (request.body.client_id !== 'default') {
          reply.code(400).send({
            error: 'client_id should be default',
          });
          return;
        }
        if (!request.body.refresh_token) {
          reply.code(400).send({
            error: 'refresh_token is required',
          });
          return;
        }

        const tokenHash = createHash('sha256')
          .update(request.body.refresh_token)
          .digest();
        const tokenHashStr = tokenHash.toString('base64url');
        request.log.debug({ hash: tokenHash }, 'hashed refresh token');

        const session = await UserSessionDAO.touchActiveSession(tokenHashStr);
        if (!session) {
          reply.code(401).send({
            error: 'invalid refresh token',
          });
          return;
        }

        if (session.client_id) {
          reply.code(501).send({
            error: 'refresh for third party apps not implemented yet',
          });
          return;
        }
        request.log.debug({ session }, 'session found for refresh token');

        let token: string;

        if (session.expires_at) {
          token = await services.authToken.generate(
            session.client_id || 0,
            session.user_id,
            session.scope.split(','),
            tokenHash,
            session.expires_at - now(),
          );
        } else {
          token = await services.authToken.generate(
            session.client_id || 0,
            session.user_id,
            session.scope.split(','),
            tokenHash,
          );
        }
        request.log.info({ uid: session.user_id }, 'generated session from refresh token');

        reply.send({
          access_token: token,
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
        const { access, refresh } = await createSession(id);
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
          reply.send({
            permissions: await RoleDAO.getRolePermissionsByName('public'),
          });
          return;
        }
        reply.send({
          permissions: await UserDAO.getPermissions(request.auth?.uid),
        });
      },
    },
  );

  fastify.post<{ Reply: ErrorResponseType }>(
    '/logout',
    {
      schema: {
        tags: ['auth'],
        response: {
          default: ErrorResponse,
        },
      },
      config: {
        permission: 'auth.self.session',
      },
      handler: async (request, reply) => {
        if (request.auth) {
          await services.authToken.revoke(request.auth.sid);
          await UserSessionDAO.revoke(
            request.auth.uid,
            Buffer.from(request.auth.sid).toString('base64url'),
          );
        }
        reply.send({});
      },
    },
  );
}
