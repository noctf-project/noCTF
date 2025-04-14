import {
  FinishAuthOauthRequest,
  InitAuthOauthRequest,
} from "@noctf/api/requests";
import {
  FinishAuthResponse,
  InitAuthOauthResponse,
  BaseResponse,
} from "@noctf/api/responses";
import { NoResultError } from "kysely";
import {
  OAuthConfigProvider,
  OAuthIdentityProvider,
} from "./oauth_provider.ts";
import type { FastifyInstance } from "fastify";
import { TokenProvider } from "./token_provider.ts";

export default async function (fastify: FastifyInstance) {
  const {
    identityService,
    configService,
    cacheService: cacheService,
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
    async (request, reply) => {
      try {
        const url = await provider.generateAuthoriseUrl(request.body.name);
        return {
          data: url,
        };
      } catch (e) {
        if (e instanceof NoResultError) {
          return reply.code(404).send({
            error: "OAuth Provider Not Found",
          });
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
}
