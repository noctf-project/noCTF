import {
  FinishAuthEmailRequest,
  InitAuthEmailRequest,
} from "@noctf/api/requests";
import { FinishAuthResponse, BaseResponse } from "@noctf/api/responses";
import { PasswordProvider } from "./password_provider.ts";
import type { FastifyInstance } from "fastify";
import { NOCTF_SESSION_COOKIE } from "./const.ts";
import { NotFoundError } from "@noctf/server-core/errors";
import { UserFlag } from "@noctf/server-core/types/enums";
import { TokenProvider } from "./token_provider.ts";

export default async function (fastify: FastifyInstance) {
  const { identityService, cacheService } = fastify.container.cradle;
  const passwordProvider = new PasswordProvider(fastify.container.cradle);
  const tokenProvider = new TokenProvider({ cacheService });

  fastify.post<{
    Body: InitAuthEmailRequest;
    Reply: FinishAuthResponse | BaseResponse;
  }>(
    "/auth/email/init",
    {
      schema: {
        tags: ["auth"],
        description:
          "Checks if an email exists, returning a message or registration token if not",
        body: InitAuthEmailRequest,
        response: {
          201: FinishAuthResponse,
          default: BaseResponse,
        },
      },
    },
    async (request, reply) => {
      const email = request.body.email.toLowerCase();
      try {
        await passwordProvider.authPreCheck(email);
        return {};
      } catch (e) {
        if (!(e instanceof NotFoundError)) throw e;
      }
      const { validate_email } = await passwordProvider.getConfig();
      const token = await tokenProvider.create('register', {
        identity: [
          {
            provider: "email",
            provider_id: email,
          },
        ],
        roles: validate_email ? [UserFlag.VALID_EMAIL] : [],
      });
      if (validate_email) {
        // TODO: send registration email
        return {
          message: "Please check your email for a link to create your account",
        };
      }

      return reply.code(201).send({
        data: {
          type: "register",
          token: token,
        },
      });
    },
  );

  fastify.post<{
    Body: FinishAuthEmailRequest;
    Reply: FinishAuthResponse | BaseResponse;
  }>(
    "/auth/email/finish",
    {
      schema: {
        tags: ["auth"],
        description: "Log a user in using their email and password",
        body: FinishAuthEmailRequest,
        response: {
          200: FinishAuthResponse,
          default: BaseResponse,
        },
      },
    },
    async (request, reply) => {
      const email = request.body.email.toLowerCase();
      const password = request.body.password;
      const token = await passwordProvider.authenticate(email, password);

      const sessionToken = identityService.generateToken(token);
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
