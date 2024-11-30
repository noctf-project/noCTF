import { Service } from "@noctf/server-core";
import {
  AuthOauthFinishRequest,
  AuthOauthInitRequest,
} from "@noctf/api/requests";
import {
  AuthFinishResponse,
  AuthOauthInitResponse,
  BaseResponse,
} from "@noctf/api/responses";
import { NoResultError } from "kysely";
import {
  OAuthConfigProvider,
  OAuthIdentityProvider,
} from "./oauth_provider.ts";

export default async function (fastify: Service) {
  const {
    identityService,
    configService,
    cacheClient,
    databaseClient,
    tokenService,
  } = fastify.container.cradle;
  const configProvider = new OAuthConfigProvider(
    configService,
    cacheClient,
    databaseClient,
  );
  const provider = new OAuthIdentityProvider(
    configProvider,
    identityService,
    tokenService,
  );
  identityService.register(provider);

  fastify.post<{
    Body: AuthOauthInitRequest;
    Reply: AuthOauthInitResponse | BaseResponse;
  }>(
    "/auth/oauth/init",
    {
      schema: {
        body: AuthOauthInitRequest,
        response: {
          200: AuthOauthInitResponse,
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
    Body: AuthOauthFinishRequest;
    Response: AuthFinishResponse;
  }>(
    "/auth/oauth/finish",
    {
      schema: {
        body: AuthOauthFinishRequest,
        response: {
          200: AuthFinishResponse,
        },
      },
    },
    async (request) => {
      const { state, code, redirect_uri } = request.body;
      const [type, result] = await provider.authenticate(
        state,
        code,
        redirect_uri,
      );
      return {
        data: {
          type,
          token: identityService.generateToken(type, result),
        },
      };
    },
  );
}
