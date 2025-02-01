import {
  RegisterAuthRequest,
  RegisterAuthTokenRequest,
} from "@noctf/api/requests";
import {
  FinishAuthResponse,
  RegisterAuthTokenResponse,
} from "@noctf/api/responses";
import type { AuthRegisterToken } from "@noctf/api/token";
import { BadRequestError } from "@noctf/server-core/errors";
import type { FastifyInstance } from "fastify";
import { Generate } from "./hash_util.ts";
import type { AssociateIdentity } from "@noctf/server-core/services/identity";
import { NOCTF_SESSION_COOKIE } from "./const.ts";

export default async function (fastify: FastifyInstance) {
  const { identityService, userService, lockService } =
    fastify.container.cradle;

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
    async (request, reply) => {
      const { password, name, token } = request.body;
      const parsed = (await identityService.validateToken(
        token,
        "register",
      )) as AuthRegisterToken;
      const id = await lockService.withLease(
        `token:register:${parsed.jti}`,
        async () => {
          const roles = parsed.roles;
          let identity = parsed.identity as AssociateIdentity[];
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
            throw new BadRequestError(
              "UserRegisterError",
              "An email is required",
            );
          }

          const hashed = password && (await Generate(password));
          identity = identity.map((i) => ({
            ...i,
            secret_data: i.provider === "email" && hashed,
            user_id: 0,
          }));

          const id = await userService.create({
            name,
            identities: identity.concat(
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
            roles,
          });

          await identityService.revokeToken(token);
          return id;
        },
      );

      const sessionToken = identityService.generateToken({
        aud: "session",
        sub: id,
      });
      reply.setCookie(NOCTF_SESSION_COOKIE, sessionToken, {
        path: "/",
        secure: true,
        httpOnly: true,
        sameSite: true,
      });
      return {
        data: {
          type: "session",
          token: sessionToken,
        },
      };
    },
  );
}
