import {
  FinishAuthEmailRequest,
  InitAuthEmailRequest,
} from "@noctf/api/requests";
import { FinishAuthResponse, BaseResponse } from "@noctf/api/responses";
import { PasswordProvider } from "./password_provider.ts";
import type { FastifyInstance } from "fastify";

export default async function (fastify: FastifyInstance) {
  const { identityService } = fastify.container.cradle;
  const passwordProvider = new PasswordProvider(fastify.container.cradle);

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
          200: BaseResponse,
          201: FinishAuthResponse,
        },
      },
    },
    async (request, reply) => {
      const email = request.body.email.toLowerCase();
      const result = await passwordProvider.authPreCheck(email);
      const { validate_email } = await passwordProvider.getConfig();
      if (!result) {
        return {};
      }

      const token = identityService.generateToken(result);
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
    async (request) => {
      const email = request.body.email.toLowerCase();
      const password = request.body.password;
      const token = await passwordProvider.authenticate(email, password);

      return {
        data: {
          type: "session",
          token: identityService.generateToken(token),
        },
      };
    },
  );
}
