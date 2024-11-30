import { Service } from "@noctf/services";
import { AuthEmailInitRequest } from "@noctf/api/ts/requests";
import { AuthEmailInitRequest as AuthEmailInitRequestJson } from "@noctf/api/jsonschema/requests";
import {
  AuthFinishResponse as AuthFinishResponseJson,
  BaseResponse as BaseResponseJson,
} from "@noctf/api/jsonschema/responses";
import {
  AuthFinishResponse,
  AuthListMethodsResponse,
  BaseResponse,
} from "@noctf/api/ts/responses";
import { CONFIG_NAMESPACE, DEFAULT_CONFIG } from "./config.ts";
import { PasswordProvider } from "./password_provider.ts";
import oauth from "./oauth.ts";

export default async function (fastify: Service) {
  fastify.register(oauth);
  const { identityService, configService } = fastify.container.cradle;
  await configService.register(CONFIG_NAMESPACE, DEFAULT_CONFIG);
  const passwordProvider = new PasswordProvider(configService, identityService);
  identityService.register(passwordProvider);

  fastify.get<{
    Reply: AuthListMethodsResponse;
  }>("/auth/methods", async () => {
    const methods = await identityService.listMethods();
    return { data: methods };
  });

  fastify.post<{
    Body: AuthEmailInitRequest;
    Reply: AuthFinishResponse | BaseResponse;
  }>(
    "/auth/email/init",
    {
      schema: {
        body: AuthEmailInitRequestJson,
        response: {
          200: AuthFinishResponseJson,
          201: BaseResponseJson,
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
