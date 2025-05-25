import {
  FinishAuthOauthRequest,
  InitAuthOauthRequest,
  OAuthTokenRequest,
} from "@noctf/api/requests";
import {
  FinishAuthResponse,
  InitAuthOauthResponse,
  BaseResponse,
  OAuthAuthorizeResponse,
  OAuthTokenResponse,
} from "@noctf/api/responses";
import { NoResultError } from "kysely";
import {
  OAuthConfigProvider,
  OAuthIdentityProvider,
} from "./oauth_client_provider.ts";
import type { FastifyInstance } from "fastify";
import { TokenProvider } from "./token_provider.ts";
import { BadRequestError, NotFoundError } from "@noctf/server-core/errors";
import { OAuthAuthorizeQuery } from "@noctf/api/query";
import { SetupConfig } from "@noctf/api/config";

export default async function (fastify: FastifyInstance) {
  const {
    identityService,
    configService,
    appService,
    cacheService,
    databaseClient,
  } = fastify.container.cradle;
  const configProvider = new OAuthConfigProvider(
    configService,
    cacheService,
    databaseClient,
  );
  const provider = new OAuthIdentityProvider(
    configProvider,
    identityService,
    new TokenProvider({ cacheService }),
  );
  identityService.register(provider);

  fastify.post<{
    Body: InitAuthOauthRequest;
    Reply: InitAuthOauthResponse | BaseResponse;
  }>(
    "/auth/oauth/init",
    {
      schema: {
        tags: ["auth"],
        body: InitAuthOauthRequest,
        response: {
          200: InitAuthOauthResponse,
          404: BaseResponse,
        },
      },
    },
    async (request) => {
      try {
        const url = await provider.generateAuthoriseUrl(request.body.name);
        return {
          data: url,
        };
      } catch (e) {
        if (e instanceof NoResultError) {
          throw new NotFoundError("OAuth Provider Not Found");
        }
        throw e;
      }
    },
  );

  fastify.post<{
    Body: FinishAuthOauthRequest;
    Response: FinishAuthResponse;
  }>(
    "/auth/oauth/finish",
    {
      schema: {
        tags: ["auth"],
        body: FinishAuthOauthRequest,
        response: {
          200: FinishAuthResponse,
        },
      },
    },
    async (request) => {
      const { state, code, redirect_uri } = request.body;
      return {
        data: await provider.authenticate(state, code, redirect_uri),
      };
    },
  );

  fastify.get<{ Querystring: OAuthAuthorizeQuery }>(
    "/auth/oauth/authorize",
    {
      schema: {
        tags: ["auth"],
        security: [{ bearer: [] }],
        querystring: OAuthAuthorizeQuery,
        response: {
          200: OAuthAuthorizeResponse,
          400: BaseResponse,
        },
      },
    },
    async (request, reply) => {
      const { client_id, redirect_uri, scope, state } = request.query;
      const userId = request.user?.id;

      if (!userId) {
        const config = await configService.get<SetupConfig>(SetupConfig.$id);
        const url = new URL(config.value.root_url);
        url.pathname = "/auth";
        url.searchParams.set("client_id", client_id);
        url.searchParams.set("redirect_uri", redirect_uri);
        url.searchParams.set("scope", scope);
        url.searchParams.set("state", state);
        return reply.redirect(url.toString());
      }

      const code = await appService.generateAuthorizationCode(
        client_id,
        redirect_uri,
        userId,
        scope.split(","),
      );
      const url = new URL(redirect_uri);
      url.searchParams.set("state", state);
      url.searchParams.set("code", code);

      return { url };
    },
  );

  fastify.post<{ Body: OAuthTokenRequest }>(
    "/auth/oauth/token",
    {
      schema: {
        tags: ["auth"],
        security: [{ bearer: [] }],
        body: OAuthTokenRequest,
        response: { 200: OAuthTokenResponse, 400: BaseResponse },
      },
    },
    async (request, reply) => {
      const authHeader = request.headers["authorization"];
      if (!authHeader || !authHeader.startsWith("Basic ")) {
        return reply.code(400).send({ error: "invalid_request" });
      }
      const userPassB64 = Buffer.from(
        authHeader.substring(6),
        "base64",
      ).toString();
      const userPass = /^([^:]*):(.*)$/.exec(userPassB64);
      if (userPass === null) {
        return reply.code(400).send({ error: "invalid_request" });
      }
      const clientId = userPass[1];
      const clientSecret = userPass[2];

      const { code, redirect_uri } = request.body;

      try {
        const result = await appService.exchangeAuthorizationCodeForToken(
          clientId,
          clientSecret,
          redirect_uri,
          code,
        );
        reply.send(result);
      } catch (e) {
        if (e instanceof BadRequestError) {
          reply.send({ error: "invalid_request" });
          return;
        }
        throw e;
      }
    },
  );
}
