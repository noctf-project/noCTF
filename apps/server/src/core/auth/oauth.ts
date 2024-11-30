import { Service } from "@noctf/services";
import {
  AuthOauthFinishRequest,
  AuthOauthInitRequest,
} from "@noctf/api/ts/requests";
import { AuthOauthFinishRequest as AuthOauthFinishRequestJson } from "@noctf/api/jsonschema/requests";
import {
  AuthFinishResponse,
  AuthOauthInitResponse,
  BaseResponse,
} from "@noctf/api/ts/responses";
import {
  AuthFinishResponse as AuthFinishResponseJson,
  AuthOauthInitResponse as AuthOauthInitResponseJson,
  BaseResponse as BaseResponseJson,
} from "@noctf/api/jsonschema/responses";
import { NoResultError } from "kysely";
import { OAuthConfigProvider, OAuthIdentityProvider } from "./oauth_provider";

export default async function (fastify: Service) {
  const { identityService, configService, databaseService } =
    fastify.container.cradle;
  const configProvider = new OAuthConfigProvider(
    configService,
    databaseService,
  );
  const provider = new OAuthIdentityProvider(configProvider, identityService);
  identityService.register(provider);

  fastify.post<{
    Body: AuthOauthInitRequest;
    Reply: AuthOauthInitResponse | BaseResponse;
  }>(
    "/auth/oauth/init",
    {
      schema: {
        body: AuthOauthFinishRequestJson,
        response: {
          200: AuthOauthInitResponseJson,
          404: BaseResponseJson,
        },
      },
    },
    async (request, reply) => {
      try {
        const { authorize_url, client_id } = await configProvider.getMethod(
          request.body.name,
        );
        const url = new URL(authorize_url);
        url.searchParams.set("client_id", client_id);
        return {
          data: url.toString(),
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
        body: AuthOauthFinishRequestJson,
        response: {
          200: AuthFinishResponseJson,
        },
      },
    },
    async (request) => {
      const { name, code, redirect_uri } = request.body;
      const [type, result] = await provider.authenticate(
        name,
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
