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
import { BadRequestError } from "@noctf/server-core/errors";

export default async function (fastify: Service) {
  fastify.register(oauth);
  const { identityService, configService, userService } =
    fastify.container.cradle;
  await configService.register(CONFIG_NAMESPACE, Config, DEFAULT_CONFIG);
  const passwordProvider = new PasswordProvider(fastify.container.cradle);

  fastify.get<{
    Reply: AuthListMethodsResponse;
  }>("/auth/methods", async () => {
    const methods = await identityService.listMethods();
    return { data: methods };
  });

  fastify.post<{
    Body: AuthRegisterTokenRequest;
    Reply: AuthRegisterTokenResponse;
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
        data: identityService.parseToken(
          "register",
          request.body.token,
        ) as AuthRegisterToken,
      };
    },
  );

  fastify.post<{
    Body: AuthRegisterRequest;
    Reply: AuthFinishResponse;
  }>(
    "/auth/register/finish",
    {
      schema: {
        body: AuthRegisterRequest,
        response: {
          200: AuthFinishResponse,
        },
      },
    },
    async (request) => {
      // TODO: handle captcha
      const { password, name, token } = request.body;
      const { group, identity } = identityService.parseToken(
        "register",
        token,
      ) as AuthRegisterToken;
      if (
        identity.length === 1 &&
        identity[0].provider === "email" &&
        !password
      ) {
        throw new BadRequestError(
          "UserRegisterError",
          "A password is required for email registration",
        );
      }
      const tokenEmail = identity.filter(
        ({ provider }) => provider === "email",
      )[0]?.provider_id;
      if (!tokenEmail && !request.body.email) {
        throw new BadRequestError("UserRegisterError", "An email is required");
      }

      const id = await userService.create(
        name,
        identity
          .map((i) => ({ ...i, user_id: 0 }))
          .concat(
            tokenEmail
              ? []
              : [
                  {
                    provider: "email",
                    provider_id: request.body.email,
                    user_id: 0,
                  },
                ],
          ),
        group,
      );
      return {
        data: {
          type: "auth",
          token: identityService.generateToken("auth", {
            user_id: id,
          }),
        },
      };
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
          200: BaseResponse,
          201: AuthFinishResponse,
        },
      },
    },
    async (request, reply) => {
      const email = request.body.email.toLowerCase();
      const result = await passwordProvider.authPreCheck(email);
      if (!result) {
        return {};
      }

      if (typeof result === "string") {
        return {
          message: result,
        };
      }

      return reply.code(201).send({
        data: {
          type: "register",
          token: await identityService.generateToken("register", result),
        },
      });
    },
  );
}
