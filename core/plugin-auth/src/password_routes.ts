import {
  AuthEmailFinishRequest,
  AuthEmailInitRequest,
} from "@noctf/api/requests";
import { AuthFinishResponse, BaseResponse } from "@noctf/api/responses";
import { Service } from "@noctf/server-core";
import { PasswordProvider } from "./password_provider.ts";

export default async function (fastify: Service) {
  const { identityService } = fastify.container.cradle;
  const passwordProvider = new PasswordProvider(fastify.container.cradle);

  fastify.post<{
    Body: AuthEmailInitRequest;
    Reply: AuthFinishResponse | BaseResponse;
  }>(
    "/auth/email/init",
    {
      schema: {
        tags: ["auth"],
        description:
          "Checks if an email exists, returning a message or registration token if not",
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
      const { validateEmail } = await passwordProvider.getConfig();
      if (!result) {
        return {};
      }

      const token = identityService.generateToken(result);
      if (validateEmail) {
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
    Body: AuthEmailFinishRequest;
    Reply: AuthFinishResponse | BaseResponse;
  }>(
    "/auth/email/finish",
    {
      schema: {
        tags: ["auth"],
        description: "Log a user in using their email and password",
        body: AuthEmailFinishRequest,
        response: {
          200: AuthFinishResponse,
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
          type: "auth",
          token: identityService.generateToken(token),
        },
      };
    },
  );
}
