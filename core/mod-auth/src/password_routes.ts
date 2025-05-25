import {
  ChangeAuthEmailRequest,
  FinishAuthEmailRequest,
  InitAuthEmailRequest,
} from "@noctf/api/requests";
import { FinishAuthResponse, BaseResponse } from "@noctf/api/responses";
import { PasswordProvider } from "./password_provider.ts";
import type { FastifyInstance } from "fastify";
import { UserFlag } from "@noctf/server-core/types/enums";
import { TokenProvider } from "./token_provider.ts";
import { UserNotFoundError } from "./error.ts";
import { EMAIL_CHANGE_TEMPLATE, EMAIL_VERIFICATION_TEMPLATE } from "./const.ts";
import { SetupConfig } from "@noctf/api/config";
import {
  AuthenticationError,
  BadRequestError,
  ConflictError,
  NotFoundError,
} from "@noctf/server-core/errors";

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
        if (!(e instanceof UserNotFoundError)) throw e;
      }
      if (!enable_register_password) {
        throw new NotFoundError("The requested auth provider cannot be found");
      }
      const token = await tokenProvider.create("register", {
        identity: [
          {
            provider: "email",
            provider_id: email,
          },
        ],
        flags: validate_email ? [UserFlag.VALID_EMAIL] : [],
      });
      if (validate_email) {
        if (!request.body.verify) {
          throw new BadRequestError(
            "EmailVerificationRequired",
            "Email Verification Required",
          );
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
      const { enable_login_password } = await passwordProvider.getConfig();
      if (!enable_login_password) {
        throw new NotFoundError("The requested auth provider cannot be found");
      }
      const email = request.body.email.toLowerCase();
      await passwordProvider.authPreCheck(email);
      const password = request.body.password;
      const user_id = await passwordProvider.authenticate(email, password);

      const { access_token } = await identityService.createSession({ user_id });

      return {
        data: {
          type: "session",
          token: access_token,
        },
      };
    },
  );

  fastify.post<{
    Body: ChangeAuthEmailRequest;
    Reply: BaseResponse;
  }>(
    "/auth/email/change",
    {
      schema: {
        security: [{ bearer: [] }],
        tags: ["auth"],
        auth: {
          require: true,
          policy: ["user.self.update"],
        },
        body: ChangeAuthEmailRequest,
        response: {
          200: BaseResponse,
        },
      },
    },
    async (request) => {
      const { validate_email, enable_register_password } =
        await passwordProvider.getConfig();
      if (!enable_register_password) {
        throw new NotFoundError("The requested auth provider cannot be found");
      }
      const { provider_id: oldEmail } =
        await identityService.getProviderForUser(request.user.id, "email");
      const newEmail = request.body.email.toLowerCase();
      const password = request.body.password;
      try {
        await passwordProvider.authenticate(oldEmail, password);
      } catch (e) {
        if (e instanceof AuthenticationError) {
          throw new AuthenticationError("Incorrect password");
        }
      }

      try {
        await passwordProvider.authPreCheck(newEmail);
        throw new ConflictError("A user already exists with this email");
      } catch (e) {
        if (!(e instanceof UserNotFoundError)) throw e;
      }

      if (validate_email) {
        const token = await tokenProvider.create("associate", {
          identity: [
            {
              provider: "email",
              provider_id: newEmail,
            },
          ],
          user_id: request.user?.id,
        });
        const { root_url, name: ctf_name } = (
          await configService.get<SetupConfig>(SetupConfig.$id!)
        ).value;
        await emailService.sendEmail({
          to: [{ address: newEmail, name: "" }],
          subject: "Verify Your Email",
          text: EMAIL_CHANGE_TEMPLATE({
            root_url,
            ctf_name,
            token,
          }),
        });
        return {
          message:
            "Please check your new email for a link to confirm your email update",
        };
      }

      // TODO: figure out how to consider valid_email user flag, we probably want to remove
      await identityService.associateIdentities([
        {
          user_id: request.user.id,
          provider: "email",
          provider_id: newEmail,
        },
      ]);
      return {};
    },
  );
}
