import {
  AuthRegisterRequest,
  AuthRegisterTokenRequest,
} from "@noctf/api/requests";
import {
  AuthFinishResponse,
  AuthRegisterTokenResponse,
} from "@noctf/api/responses";
import { AuthRegisterToken } from "@noctf/api/token";
import { Service } from "@noctf/server-core";
import { BadRequestError } from "@noctf/server-core/errors";

export default async function (fastify: Service) {
  const { identityService, userService } = fastify.container.cradle;

  fastify.post<{
    Body: AuthRegisterTokenRequest;
    Reply: AuthRegisterTokenResponse;
  }>(
    "/auth/register/token",
    {
      schema: {
        tags: ["auth"],
        body: AuthRegisterTokenRequest,
        response: {
          200: AuthRegisterTokenResponse,
        },
      },
    },
    async (request) => {
      return {
        data: (await identityService.validateToken(
          "register",
          request.body.token,
        )) as AuthRegisterToken,
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
        tags: ["auth"],
        body: AuthRegisterRequest,
        response: {
          200: AuthFinishResponse,
        },
      },
    },
    async (request) => {
      // TODO: handle captcha
      const { password, name, token } = request.body;
      const { flags, identity } = (await identityService.validateToken(
        "register",
        token,
      )) as AuthRegisterToken;
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
        flags,
      );
      return {
        data: {
          type: "auth",
          token: identityService.generateToken({
            type: "auth",
            sub: id,
          }),
        },
      };
    },
  );
}
