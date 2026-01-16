import { PasswordProvider } from "./password_provider.ts";
import type { FastifyInstance, FastifyRequest } from "fastify";
import {
  ActorType,
  EntityType,
  UserFlag,
} from "@noctf/server-core/types/enums";
import { UserNotFoundError } from "./error.ts";
import {
  EMAIL_CHANGE_TEMPLATE,
  EMAIL_VERIFICATION_TEMPLATE,
  EMAIL_RESET_PASSWORD_TEMPLATE,
} from "./const.ts";
import { SetupConfig } from "@noctf/api/config";
import {
  AuthenticationError,
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from "@noctf/server-core/errors";
import { Generate } from "./hash_util.ts";
import { NormalizeEmail } from "@noctf/server-core/util/string";
import {
  GetRouteKey,
  GetRouteUserIPKey,
  NormalizeIPPrefix,
} from "@noctf/server-core/util/limit_keys";
import { TokenService } from "@noctf/server-core/services/token";
import { route } from "@noctf/server-core/util/route";
import {
  ApplyResetEmail,
  ChangeEmail,
  ChangePassword,
  CreateResetEmail,
  FinishEmailAuth,
  InitEmailAuth,
  VerifyEmailAuth,
} from "@noctf/api/contract/mod_auth";
import {
  CreateResetAuthEmailRequest,
  InitAuthEmailRequest,
} from "@noctf/api/requests";

const IsEmailAllowed = (allowedDomains: string[] | undefined, email: string) =>
  !allowedDomains?.length ||
  (allowedDomains.length &&
    allowedDomains.includes(
      (email.toLowerCase().split("@")[1] || "").replace(/\.$/, ""),
    ));

export default async function (fastify: FastifyInstance) {
  const {
    identityService,
    configService,
    tokenService,
    emailService,
    lockService,
    auditLogService,
  } = fastify.container.cradle;
  const passwordProvider = new PasswordProvider(fastify.container.cradle);

  route(
    fastify,
    InitEmailAuth,
    {
      rateLimit: (r) => [
        {
          key: `${GetRouteKey(r)}:i${NormalizeIPPrefix(r.ip)}`,
          limit: 10,
          windowSeconds: 60,
        },
      ],
    },
    async (request) => {
      const {
        validate_email,
        allowed_email_domains,
        enable_register_password,
      } = await passwordProvider.getConfig();
      const email = request.body.email.toLowerCase();
      try {
        await passwordProvider.authPreCheck(email);
      } catch (e) {
        if (e instanceof UserNotFoundError) {
          if (!enable_register_password) {
            throw new ForbiddenError("Registration is currently not open");
          }
          if (!IsEmailAllowed(allowed_email_domains, email)) {
            throw new ForbiddenError(
              "Registration is only open to specific domains",
            );
          }
          if (validate_email)
            throw new BadRequestError(
              "EmailVerificationRequired",
              "Email Verification Required",
            );
        }
        throw e;
      }
      return {};
    },
  );

  route(
    fastify,
    VerifyEmailAuth,
    {
      rateLimit: (r) => [
        {
          key: `${GetRouteKey(r)}:i${NormalizeIPPrefix(r.ip)}`,
          limit: 10,
          windowSeconds: 60,
        },
        {
          key: `${GetRouteKey(r)}:e:${NormalizeEmail(r.body.email)}`,
          limit: 5,
          windowSeconds: 60,
        },
      ],
    },
    async (request, reply) => {
      const {
        validate_email,
        enable_register_password,
        allowed_email_domains,
      } = await passwordProvider.getConfig();
      if (!enable_register_password) {
        throw new NotFoundError("The requested auth provider cannot be found");
      }
      const email = request.body.email.toLowerCase();
      try {
        await passwordProvider.authPreCheck(email);
        throw new ForbiddenError("A user exists with this email");
      } catch (e) {
        if (!(e instanceof UserNotFoundError)) throw e;
      }
      if (!IsEmailAllowed(allowed_email_domains, email)) {
        throw new ForbiddenError(
          "Registration is only open to specific domains",
        );
      }
      const token = await tokenService.create("register", {
        identity: [
          {
            provider: "email",
            provider_id: email,
          },
        ],
        flags: validate_email ? [UserFlag.VALID_EMAIL] : [],
      });
      if (validate_email) {
        const { root_url, name: ctf_name } = (
          await configService.get(SetupConfig)
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

  route(
    fastify,
    CreateResetEmail,
    {
      rateLimit: (r) => [
        {
          key: `${GetRouteKey(r)}:i${NormalizeIPPrefix(r.ip)}`,
          limit: 10,
          windowSeconds: 60,
        },
        {
          key: `${GetRouteKey(r)}:e:${NormalizeEmail(r.body.email)}`,
          limit: 5,
          windowSeconds: 60,
        },
      ],
    },
    async (request) => {
      const { enable_login_password } = await passwordProvider.getConfig();
      if (!enable_login_password) {
        throw new NotFoundError("The requested auth provider cannot be found");
      }
      const email = request.body.email.toLowerCase();
      const identity = await identityService.getIdentityForProvider(
        "email",
        email,
      );
      if (!identity) {
        throw new UserNotFoundError();
      }
      const token = await tokenService.create("reset_password", {
        user_id: identity.user_id,
        created_at: new Date(),
      });
      const { root_url, name: ctf_name } = (
        await configService.get(SetupConfig)
      ).value;
      await emailService.sendEmail({
        to: [{ address: email, name: "" }],
        subject: "Reset your password",
        text: EMAIL_RESET_PASSWORD_TEMPLATE({
          root_url,
          ctf_name,
          token,
        }),
      });
      await auditLogService.log({
        operation: "user.reset_password.init",
        actor: {
          type: ActorType.ANONYMOUS,
        },
        data: "Self-service reset password via email",
        entities: [`${EntityType.USER}:${identity.user_id}`],
      });
      return {};
    },
  );

  route(fastify, ApplyResetEmail, {}, async (request) => {
    const { token, password } = request.body;
    const data = await tokenService.lookup("reset_password", token);
    const id = await lockService.withLease(
      `token:${TokenService.hash("reset_password", token)}`,
      async () => {
        const identity = await identityService.getProviderForUser(
          data.user_id,
          "email",
        );
        if (identity.updated_at > data.created_at) {
          throw new ForbiddenError("Invalid token", {
            cause: new Error("Password reset after token created"),
          });
        }
        await identityService.associateIdentities([
          {
            ...identity,
            secret_data: await Generate(password),
          },
        ]);
        await identityService.revokeUserSessions(identity.user_id, null);
        await tokenService.invalidate("reset_password", token);
        return identity.user_id;
      },
    );
    await auditLogService.log({
      operation: "user.reset_password.finish",
      actor: {
        type: ActorType.USER,
        id,
      },
      data: "Password reset using token",
      entities: [`${EntityType.USER}:${id}`],
    });
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
  });

  route(
    fastify,
    FinishEmailAuth,
    {
      rateLimit: (r) => [
        {
          key: `${GetRouteKey(r)}:i${NormalizeIPPrefix(r.ip)}`,
          limit: 30,
          windowSeconds: 60,
        },
      ],
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

      const { access_token } = await identityService.createSession({
        user_id,
        ip: request.ip,
      });

      return {
        data: {
          type: "session",
          token: access_token,
        },
      };
    },
  );

  route(
    fastify,
    ChangeEmail,
    {
      auth: {
        require: true,
        policy: ["user.self.update"],
      },
      rateLimit: (r) => [
        {
          key: GetRouteUserIPKey(r),
          limit: 5,
          windowSeconds: 60,
        },
      ],
    },
    async (request) => {
      const { validate_email } = await passwordProvider.getConfig();
      const identity = await identityService.getProviderForUser(
        request.user.id,
        "email",
      );
      const password = request.body.password;
      try {
        await passwordProvider.authenticate(identity.provider_id, password);
      } catch (e) {
        if (e instanceof AuthenticationError) {
          throw new AuthenticationError("Incorrect password");
        }
        throw e;
      }

      const email = request.body.email.toLowerCase();
      try {
        await passwordProvider.authPreCheck(email);
        throw new ConflictError("A user already exists with this email");
      } catch (e) {
        if (!(e instanceof UserNotFoundError)) throw e;
      }

      if (validate_email) {
        const token = await tokenService.create("associate", {
          identity: [
            {
              provider: "email",
              provider_id: email,
            },
          ],
          user_id: request.user?.id,
        });
        const { root_url, name: ctf_name } = (
          await configService.get(SetupConfig)
        ).value;
        await emailService.sendEmail({
          to: [{ address: email, name: "" }],
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
      } else {
        // TODO: figure out how to consider valid_email user flag, we probably want to remove
        await identityService.associateIdentities([
          {
            user_id: request.user.id,
            provider: "email",
            provider_id: email,
          },
        ]);
        return {};
      }
    },
  );

  route(
    fastify,
    ChangePassword,
    {
      auth: {
        require: true,
        policy: ["user.self.update"],
      },
      rateLimit: (r) => [
        {
          key: GetRouteUserIPKey(r),
          limit: 5,
          windowSeconds: 60,
        },
      ],
    },
    async (request) => {
      const identity = await identityService.getProviderForUser(
        request.user.id,
        "email",
      );
      const password = request.body.password;
      const newPassword = request.body.newPassword;
      if (password === newPassword) {
        throw new BadRequestError(
          "BadRequestError",
          "Your new password matches your current password",
        );
      }
      try {
        await passwordProvider.authenticate(identity.provider_id, password);
      } catch (e) {
        if (e instanceof AuthenticationError) {
          throw new AuthenticationError("Incorrect password");
        }
        throw e;
      }

      await identityService.associateIdentities([
        {
          ...identity,
          secret_data: await Generate(newPassword),
        },
      ]);
      await identityService.revokeUserSessions(identity.user_id, null);
      const sessionToken = await identityService.createSession({
        user_id: request.user.id,
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
