import { FastifyInstance } from 'fastify';
import { TOKEN_EXPIRY } from '../../config';
import { AuthTokenRequest, AuthTokenRequestType } from '../../schemas/requests';
import {
  ErrorResponseType,
  AuthTokenResponse, AuthTokenResponseType, AuthJWKSResponseType, AuthJWKSResponse,
} from '../../schemas/responses';
import services from '../../services';
import { now } from '../../util/helpers';
import { ipKeyGenerator } from '../../util/ratelimit';
import UserSessionDAO from '../../models/UserSession';

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

        const session = await UserSessionDAO.touchRefreshToken(request.body.refresh_token);
        if (!session) {
          reply.code(401).send({
            error: 'invalid refresh token',
          });
          return;
        }

        if (session.app_id) {
          reply.code(501).send({
            error: 'refresh for third party apps not implemented yet',
          });
          return;
        }
        request.log.debug({ session }, 'session found for refresh token');

        let token: string;

        if (session.expires_at) {
          token = await services.authToken.generate(
            session.app_id || 0,
            session.user_id,
            session.scope.split(','),
            Buffer.from(session.session_hash, 'base64url'),
            session.expires_at - now(),
          );
        } else {
          token = await services.authToken.generate(
            session.app_id || 0,
            session.user_id,
            session.scope.split(','),
            Buffer.from(session.session_hash, 'base64url'),
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
}
