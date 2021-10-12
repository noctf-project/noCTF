import { FastifyInstance } from 'fastify';
import { URLSearchParams } from 'url';
import { TOKEN_EXPIRY } from '../../config';
import {
  AuthGrantRequest, AuthGrantRequestType,
  AuthConsentRequest, AuthConsentRequestType,
  AuthTokenRequest, AuthTokenRequestType,
} from '../../schemas/requests';
import {
  ErrorResponseType,
  AuthTokenResponse, AuthTokenResponseType,
  AuthJWKSResponseType, AuthJWKSResponse,
  AuthConsentResponse, AuthConsentResponseType,
  AuthGrantResponseType, AuthGrantResponse,
} from '../../schemas/responses';
import services from '../../services';
import { now } from '../../util/helpers';
import { ipKeyGenerator } from '../../util/ratelimit';
import { AuthAuthorizeQuery, AuthAuthorizeQueryType } from '../../schemas/queries';
import AppDAO from '../../models/App';
import UserSessionDAO from '../../models/UserSession';
import ScopeDAO, { Scope } from '../../models/Scope';

export default async function register(fastify: FastifyInstance) {
  fastify.get<{ Reply: AuthJWKSResponseType }>(
    '/jwks',
    {
      schema: {
        tags: ['auth'],
        description: 'List the token signing keys.',
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

  fastify.get<{ Querystring: AuthAuthorizeQueryType, Reply: ErrorResponseType }>(
    '/authorize',
    {
      schema: {
        querystring: AuthAuthorizeQuery,
        description: 'OAuth2 Authorize endpoint',
        tags: ['auth'],
        security: [],
      },
      handler: async (request, reply) => {
        // Lookup client ID
        const {
          client_id, redirect_uri, response_type, scope, state,
        } = request.query;
        const app = await AppDAO.getByClientID(request.query.client_id);

        if (!app || !app.enabled) {
          reply.code(400).send({
            error: 'invalid client_id',
          });
          return;
        }

        // Check if redirect URI is legit
        const origins = app.allowed_redirect_uris.split(',');
        const uri = new URL(request.query.redirect_uri);
        if (origins.indexOf(`${uri.origin}${uri.pathname}`) === -1) {
          reply.code(400).send({
            error: 'invalid redirect_uri for client_id',
          });
        }

        // TODO: check if scope is legit
        const redirectQuery = new URLSearchParams(
          {
            client_id, redirect_uri, response_type, scope, state,
          },
        );
        reply.redirect(307, `/authorize?${redirectQuery.toString()}`);
      },
    },
  );

  fastify.post<{
    Body: AuthGrantRequestType,
    Reply: ErrorResponseType | AuthGrantResponseType
  }>('/grant', {
    schema: {
      tags: ['auth'],
      body: AuthGrantRequest,
      description: 'Authorize an OAuth2 application and generate an authorization code.',
      response: {
        default: AuthGrantResponse,
      },
    },
    config: {
      permission: 'auth.self.authorize',
    },
    handler: async (request, reply) => {
      // Lookup client ID
      const { client_id, response_type, scope } = request.body;
      const app = await AppDAO.getByClientID(client_id);
      if (!app || !app.enabled) {
        reply.code(400).send({
          error: 'invalid client_id',
        });
        return;
      }

      const scopeSet = new Set(scope.map((s) => s.toLowerCase()));

      const scopes = (await
      Promise.all(Array.from(scopeSet).map((name) => ScopeDAO.getByName(name)))
      );
      if (scopes.indexOf(null) !== -1) {
        reply.code(400).send({
          error: 'one or more scopes are invalid',
        });
        return;
      }

      reply.send({
        token: await services.authToken.generateOAuthCode(
          app.id,
          request.auth.uid,
          Array.from(scopeSet),
        ),
        response_type,
      });
    },
  });

  fastify.post<{
    Body: AuthConsentRequestType,
    Reply: ErrorResponseType | AuthConsentResponseType
  }>(
    '/consent',
    {
      schema: {
        body: AuthConsentRequest,
        description: 'Show information for the consent screen',
        tags: ['auth'],
        response: {
          default: AuthConsentResponse,
        },
      },
      config: {
        permission: 'auth.self.authorize',
      },
      handler: async (request, reply) => {
        const app = await AppDAO.getByClientID(request.body.client_id);
        if (!app || !app.enabled) {
          reply.code(404).send({
            error: 'invalid client_id',
          });
          return;
        }

        const scopeSet = new Set(request.body.scope.map((s) => s.toLowerCase()));

        const scopes = (await
        Promise.all(Array.from(scopeSet).map((name) => ScopeDAO.getByName(name)))
        );

        if (scopes.indexOf(null) !== -1) {
          reply.code(400).send({
            error: 'one or more scopes are invalid',
          });
          return;
        }

        reply.send({
          name: app.name,
          description: app.description,
          scopes: (scopes as unknown as Scope[])
            .map(({ name, description }) => ({ name, description })),
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
        description: 'OAuth2 token endpoint',
        security: [],
        body: AuthTokenRequest,
        response: {
          default: AuthTokenResponse,
        },
        consumes: ['application/json', 'application/x-www-form-urlencoded'],
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

        // TODO: fix permission by converting scopes to permissions
        if (session.expires_at) {
          token = await services.authToken.generate(
            session.app_id || 0,
            session.user_id,
            [['*']],
            Buffer.from(session.session_hash, 'base64url'),
            session.expires_at - now(),
          );
        } else {
          token = await services.authToken.generate(
            session.app_id || 0,
            session.user_id,
            [['*']],
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
