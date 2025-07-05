import { RegisterAuthRequest } from "@noctf/api/requests";
import { BaseResponse, FinishAuthResponse } from "@noctf/api/responses";
import { BadRequestError } from "@noctf/server-core/errors";
import type { FastifyInstance } from "fastify";
import { Generate } from "./hash_util.ts";
import type { AssociateIdentity } from "@noctf/server-core/services/identity";
import { TokenProvider } from "./token_provider.ts";
import {
  RegisterAuthTokenRequest,
  RegisterAuthTokenResponse,
} from "./api_schema.ts";

export default async function (fastify: FastifyInstance) {
  const { identityService, userService, lockService, cacheService } =
    fastify.container.cradle;

  const tokenProvider = new TokenProvider({ cacheService });

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
          default: BaseResponse,
        },
      },
    },
    async (request) => {
      return {
        data: await tokenProvider.lookup("register", request.body.token),
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
          default: BaseResponse,
        },
      },
    },
    async (request) => {
      const { password, name, token } = request.body;
      const data = await tokenProvider.lookup("register", token);
      const id = await lockService.withLease(
        `token:register:${TokenProvider.hash(token)}`,
        async () => {
          const { flags, roles } = data;
          let identity = data.identity as AssociateIdentity[];
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
            flags,
          });

          await tokenProvider.invalidate("register", token);
          return id;
        },
      );
      const sessionToken = await identityService.createSession({
        user_id: id,
        ip: request.ip,
      });
      return {
        data: {
          type: "session",
          token: sessionToken.access_token,
        },
      };
    },
  );
}
