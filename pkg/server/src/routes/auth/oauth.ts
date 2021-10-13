import { FastifyInstance } from 'fastify';
import { URLSearchParams } from 'url';
import { createHash } from 'crypto';
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
import AppDAO, { App } from '../../models/App';
import UserSessionDAO from '../../models/UserSession';
import ScopeDAO, { Scope } from '../../models/Scope';
import { AuthAuthorizeGrantTypeEnum } from '../../schemas/datatypes';
import { createSession } from '../../util/session';
import { AuthTokenServiceError } from '../../services/auth_token';

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
        reply.redirect(302, `/authorize?${redirectQuery.toString()}`);
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

      const dedupedScopes = Array.from(new Set(scope.map((s) => s.toLowerCase())));
      const scopes = (await
        Promise.all(dedupedScopes.map((name) => ScopeDAO.getByName(name)))
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
          dedupedScopes,
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

        const dedupedScopes = Array.from(new Set(request.body.scope.map((s) => s.toLowerCase())));
        const scopes = (await
          Promise.all(dedupedScopes.map((name) => ScopeDAO.getByName(name)))
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
        let aid = 0;
        let app: App | undefined;
        if (request.body.client_id !== 'default') {
          app = await AppDAO.getByClientID(request.body.client_id);
          if (!app || !app.enabled) {
            reply.code(404).send({
              error: 'invalid client_id',
            });
            return;
          }
          const secretHash = createHash('sha256').update(request.body.client_secret || '').digest();
          if (!secretHash.equals(Buffer.from(app!.client_secret_hash, 'base64url'))) {
            reply.code(400).send({
              error: 'invalid client secret',
            });
            return;
          }
          aid = app.id;
        }

        switch (request.body.grant_type) {
          case AuthAuthorizeGrantTypeEnum.Code: {
            if (!request.body.code || aid === 0) {
              reply.code(400).send({
                error: 'invalid parameters',
              });
              return;
            }
            try {
              const code = await services.authToken.validateOauthCode(request.body.code, aid);
              const { refresh, access } = await createSession(
                code.uid,
                code.aid,
                code.scp,
                Buffer.from(code.tok).toString('base64url'),
              );
              reply.send({
                access_token: access,
                refresh_token: refresh,
                expires: TOKEN_EXPIRY,
              });
            } catch (e) {
              if (e instanceof AuthTokenServiceError) {
                reply.code(400).send({
                  error: 'invalid code',
                });
                return;
              }
              throw e;
            }
            break;
          }
          case AuthAuthorizeGrantTypeEnum.RefreshToken: {
            if (!request.body.refresh_token) {
              reply.code(400).send({
                error: 'refresh_token is required',
              });
              return;
            }
            const session = await UserSessionDAO.touchRefreshToken(request.body.refresh_token, aid);
            if (!session) {
              reply.code(401).send({
                error: 'invalid refresh token',
              });
              return;
            }
            request.log.debug({ session }, 'session found for refresh token');

            const token = await services.authToken.generate(
              session.app_id || 0,
              session.user_id,
              aid === 0
                ? [['*']]
                : (await Promise.all(session.scope.split(',').map(
                  (s) => ScopeDAO.getPermissionsByName(s),
                ))),
              Buffer.from(session.session_hash, 'base64url'),
              session.expires_at ? session.expires_at - now() : 0,
            );

            request.log.info({ uid: session.user_id }, 'generated session from refresh token');

            reply.send({
              access_token: token,
              expires: TOKEN_EXPIRY,
            });
            break;
          }
          default:
            reply.send({
              error: 'invalid token grant type',
            });
        }
      },
    },
  );
}
