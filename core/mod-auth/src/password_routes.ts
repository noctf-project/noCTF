import {
  FinishAuthEmailRequest,
  InitAuthEmailRequest,
} from "@noctf/api/requests";
import { FinishAuthResponse, BaseResponse } from "@noctf/api/responses";
import { PasswordProvider } from "./password_provider.ts";
import type { FastifyInstance } from "fastify";
import { UserRole } from "@noctf/server-core/types/enums";
import { TokenProvider } from "./token_provider.ts";
import { UserNotFoundError } from "./error.ts";
import { EMAIL_VERIFICATION_TEMPLATE } from "./const.ts";
import { SetupConfig } from "@noctf/api/config";

export default async function (fastify: FastifyInstance) {
  const { identityService, configService, cacheService, emailService } =
    fastify.container.cradle;
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
      const { validate_email, enable_register_password } =
        await passwordProvider.getConfig();
      const email = request.body.email.toLowerCase();
      try {
        await passwordProvider.authPreCheck(email);
        return {};
      } catch (e) {
        if (!(e instanceof UserNotFoundError) || !enable_register_password)
          throw e;
      }
      const token = await tokenProvider.create("register", {
        identity: [
          {
            provider: "email",
            provider_id: email,
          },
        ],
        roles: validate_email ? [UserRole.VALID_EMAIL] : [],
      });
      if (validate_email) {
        if (!request.body.verify) {
          return reply.code(400).send({
            error: "EmailVerificationRequired",
            message: "Email Verification Required",
          });
        }
        const { root_url, name: ctf_name } = (
          await configService.get<SetupConfig>(SetupConfig.$id!)
        ).value;
        await emailService.sendEmail({
          to: [{ address: email, name: "" }],
          subject: "Verify Your Email",
          text: EMAIL_VERIFICATION_TEMPLATE({
            root_url,
            ctf_name,
            token,
          }),
        });
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

      const sessionToken = identityService.generateToken(token);

      return {
        data: {
          type: "session",
          token: sessionToken,
        },
      };
    },
  );
}
