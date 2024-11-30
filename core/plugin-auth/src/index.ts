import { Service } from "@noctf/server-core";
import {
  AuthEmailInitRequest,
  AuthRegisterRequest,
  AuthRegisterTokenRequest,
} from "@noctf/api/requests";
import {
  AuthFinishResponse,
  AuthListMethodsResponse,
  AuthRegisterTokenResponse,
  BaseResponse,
} from "@noctf/api/responses";
import { CONFIG_NAMESPACE, Config, DEFAULT_CONFIG } from "./config.ts";
import { PasswordProvider } from "./password_provider.ts";
import oauth from "./oauth.ts";
import { AuthRegisterToken } from "@noctf/api/token";

export default async function (fastify: Service) {
  fastify.register(oauth);
  const { identityService, configService } = fastify.container.cradle;
  await configService.register(CONFIG_NAMESPACE, Config, DEFAULT_CONFIG);
  const passwordProvider = new PasswordProvider(configService, identityService);
  identityService.register(passwordProvider);

  fastify.get<{
    Reply: AuthListMethodsResponse;
  }>("/auth/methods", async () => {
    const methods = await identityService.listMethods();
    return { data: methods };
  });

  fastify.post<{
    Body: AuthRegisterTokenRequest;
    Response: AuthRegisterTokenResponse;
  }>(
    "/auth/register/token",
    {
      schema: {
        body: AuthRegisterTokenRequest,
        response: {
          200: AuthRegisterTokenResponse,
        },
      },
    },
    async (request) => {
      return {
        data: identityService.parseToken("register", request.body.token),
      };
    },
  );

  fastify.post<{
    Body: AuthRegisterRequest;
  }>(
    "/auth/register/finish",
    {
      schema: {
        body: AuthRegisterRequest,
      },
    },
    async (request) => {
      const { group, identity } = identityService.parseToken(
        "register",
        request.body.token,
      ) as AuthRegisterToken;
      // TODO
      console.log(group, identity);
      return {};
    },
  );

  fastify.post<{
    Body: AuthEmailInitRequest;
    Reply: AuthFinishResponse | BaseResponse;
  }>(
    "/auth/email/init",
    {
      schema: {
        body: AuthEmailInitRequest,
        response: {
          200: AuthFinishResponse,
          201: BaseResponse,
        },
      },
    },
    async (request, reply) => {
      const email = request.body.email.toLowerCase();
      const result = await passwordProvider.authPreCheck(email);
      if (!result) {
        return reply.code(201).send({});
      }

      if (typeof result === "string") {
        return {
          message: result,
        };
      }

      return {
        data: {
          type: "register",
          token: await identityService.generateToken("register", result),
        },
      };
    },
  );
}
