import {
  RegisterAuthRequest,
  RegisterAuthTokenRequest,
} from "@noctf/api/requests";
import {
  FinishAuthResponse,
  RegisterAuthTokenResponse,
} from "@noctf/api/responses";
import { AuthRegisterToken } from "@noctf/api/token";
import { Service } from "@noctf/server-core";
import { BadRequestError } from "@noctf/server-core/errors";

export default async function (fastify: Service) {
  const { identityService, userService } = fastify.container.cradle;

  fastify.post<{
    Body: RegisterAuthTokenRequest;
    Reply: RegisterAuthTokenResponse;
  }>(
    "/auth/register/token",
    {
      schema: {
        tags: ["auth"],
        body: RegisterAuthTokenRequest,
        response: {
          200: RegisterAuthTokenResponse,
        },
      },
    },
    async (request) => {
      return {
        data: (await identityService.validateToken(
          request.body.token,
          "register",
        )) as AuthRegisterToken,
      };
    },
  );

  fastify.post<{
    Body: RegisterAuthRequest;
    Reply: FinishAuthResponse;
  }>(
    "/auth/register/finish",
    {
      schema: {
        tags: ["auth"],
        body: RegisterAuthRequest,
        response: {
          200: FinishAuthResponse,
        },
      },
    },
    async (request) => {
      const { password, name, token } = request.body;
      const { flags, identity } = (await identityService.validateToken(
        token,
        "register",
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
      await identityService.revokeToken(token);
      return {
        data: {
          type: "session",
          token: identityService.generateToken({
            type: "session",
            sub: id,
          }),
        },
      };
    },
  );
}
