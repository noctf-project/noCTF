import {
  ChangeAuthEmailRequest,
  ChangeFinishAuthEmailRequest,
  FinishAuthEmailRequest,
  InitAuthEmailRequest,
} from "@noctf/api/requests";
import {
  FinishAuthResponse,
  BaseResponse,
  SuccessResponse,
} from "@noctf/api/responses";
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
} from "@noctf/server-core/errors";
import { AssociateIdentity } from "@noctf/server-core/services/identity";

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

  fastify.post<{
    Body: ChangeAuthEmailRequest;
    Reply: FinishAuthResponse | BaseResponse;
  }>(
    "/auth/email/change/init",
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
          201: FinishAuthResponse,
          default: BaseResponse,
        },
      },
    },
    async (request, reply) => {
      const { validate_email, enable_register_password } =
        await passwordProvider.getConfig();
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
        if (!(e instanceof UserNotFoundError) || !enable_register_password)
          throw e;
      }

      const token = await tokenProvider.create("change", {
        identity: [
          {
            provider: "email",
            provider_id: newEmail,
          },
        ],
      });
      if (validate_email) {
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

      return reply.code(201).send({
        data: {
          type: "change",
          token: token,
        },
      });
    },
  );

  fastify.post<{
    Body: ChangeFinishAuthEmailRequest;
    Reply: SuccessResponse;
  }>(
    "/auth/email/change/finish",
    {
      schema: {
        security: [{ bearer: [] }],
        tags: ["auth"],
        auth: {
          require: true,
          policy: ["user.self.update"],
        },
        body: ChangeFinishAuthEmailRequest,
        response: {
          200: SuccessResponse,
        },
      },
    },
    async (request) => {
      const { token } = request.body;
      const data = await tokenProvider.lookup("change", token);
      const oldIdentity = await identityService.getProviderForUser(
        request.user.id,
        "email",
      );
      const tokenEmail = data.identity.filter(
        ({ provider }) => provider === "email",
      )[0]?.provider_id;
      if (!tokenEmail) {
        throw new BadRequestError("EmailChangeError", "An email is required");
      }
      const identity: AssociateIdentity = {
        ...oldIdentity,
        provider_id: tokenEmail,
      };
      await identityService.associateIdentity(identity);
      return { data: true };
    },
  );
}
