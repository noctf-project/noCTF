import { Service } from "@noctf/services";
import {
  AuthOauthFinishRequest,
  AuthOauthInitRequest,
} from "@noctf/api/ts/requests";
import { AuthOauthFinishRequest as AuthOauthFinishRequestJson } from "@noctf/api/jsonschema/requests";
import { AuthOauthInitResponse, ErrorResponse } from "@noctf/api/ts/responses";
import {
  AuthOauthInitResponse as AuthOauthInitResponseJson,
  ErrorResponse as ErrorResponseJson,
} from "@noctf/api/jsonschema/responses";
import { NoResultError } from "kysely";
import { OAuthProvider } from "./oauth_provider";

export default async function (fastify: Service) {
  const { authService, configService, databaseService } =
    fastify.container.cradle;

  const provider = new OAuthProvider(configService, databaseService);
  authService.register(provider);

  fastify.get<{
    Params: AuthOauthInitRequest;
    Reply: AuthOauthInitResponse | ErrorResponse;
  }>(
    "/auth/oauth/init/:name",
    {
      schema: {
        response: {
          200: AuthOauthInitResponseJson,
          404: ErrorResponseJson,
        },
      },
    },
    async (request, reply) => {
      try {
        const { authorize_url, client_id } = await provider.getMethod(
          request.params.name,
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
  }>(
    "/auth/oauth/finish",
    {
      schema: {
        body: AuthOauthFinishRequestJson,
      },
    },
    async (request) => {
      const { name, code, redirect_uri } = request.body;
      return await provider.authenticate(name, code, redirect_uri);
    },
  );
}
