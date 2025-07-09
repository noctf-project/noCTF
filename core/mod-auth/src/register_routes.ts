import { RegisterAuthRequest } from "@noctf/api/requests";
import { BaseResponse, FinishAuthResponse } from "@noctf/api/responses";
import { BadRequestError } from "@noctf/server-core/errors";
import type { FastifyInstance } from "fastify";
import { Generate } from "./hash_util.ts";
import type { AssociateIdentity } from "@noctf/server-core/services/identity";
import {
  RegisterAuthTokenRequest,
  RegisterAuthTokenResponse,
} from "./api_schema.ts";
import { TokenService } from "@noctf/server-core/services/token";
import { ActorType } from "@noctf/server-core/types/enums";
import { SetupConfig } from "@noctf/api/config";

export default async function (fastify: FastifyInstance) {
  const {
    identityService,
    userService,
    lockService,
    tokenService,
    configService,
  } = fastify.container.cradle;

  const TryInitializeInitialAdminUser = async (
    id: number,
    roles: string[] = [],
  ) => {
    let cfg = await configService.get(SetupConfig);

    // if the site has not been initialised, make the user an admin
    if (cfg.value.initialized) {
      return;
    }

    const actor = { type: ActorType.SYSTEM, id: "oobe" };
    try {
      cfg = await configService.update({
        namespace: SetupConfig.$id!,
        value: { ...cfg.value, initialized: true },
        version: cfg.version,
        noValidate: true,
        actor,
      });
    } catch (error) {
      fastify.log.warn(
        { error },
        "Could not update flag to initialise CTF, perhaps something raced",
      );
      return;
    }

    fastify.log.info({ u: id }, "Setting user to admin as part of OOBE");
    try {
      await userService.update(
        id,
        { roles: [...new Set([...roles, "admin"])] },
        {
          actor,
          message: "Promoting initial user to admin",
        },
      );
    } catch (error) {
      fastify.log.warn(
        { u: id, error },
        "Error updating user roles to admin as part of OOBE",
      );

      // rollback config since there is no admin user
      try {
        await configService.update({
          namespace: SetupConfig.$id!,
          value: { ...cfg.value, initialized: false },
          version: cfg.version,
          noValidate: true,
          actor,
        });
      } catch (e) {
        fastify.log.warn(
          e,
          "Failed to rollback configuration, database edit for admin is required",
        );
      }
    }
  };

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
        data: await tokenService.lookup("register", request.body.token),
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
      const data = await tokenService.lookup("register", token);
      const id = await lockService.withLease(
        `token:${TokenService.hash("register", token)}`,
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

          const id = await userService.create(
            {
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
            },
            {
              actor: { type: ActorType.ANONYMOUS },
              message: "Self-service user creation",
            },
          );

          await tokenService.invalidate("register", token);
          return id;
        },
      );
      await TryInitializeInitialAdminUser(id, data.roles);
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
