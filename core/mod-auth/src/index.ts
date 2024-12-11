import { ListAuthMethodsResponse } from "@noctf/api/responses";
import { DEFAULT_CONFIG } from "./const.ts";
import password_routes from "./password_routes.ts";
import oauth_routes from "./oauth_routes.ts";
import register_routes from "./register_routes.ts";
import { FastifyInstance } from "fastify/types/instance.js";
import { AuthConfig } from "@noctf/api/config";
import { AuthnHook } from "@noctf/server-core/hooks/authn";
import "@noctf/server-core/types/fastify";

declare module "fastify" {
  interface FastifySchema {
    tags?: string[];
    description?: string;
  }
}

export async function initServer(fastify: FastifyInstance) {
  const { identityService, configService, logger } = fastify.container.cradle;
  await configService.register(AuthConfig, DEFAULT_CONFIG);
  fastify.register(oauth_routes);
  fastify.register(password_routes);
  fastify.register(register_routes);

  fastify.get<{
    Reply: ListAuthMethodsResponse;
  }>(
    "/auth/methods",
    {
      schema: {
        tags: ["auth"],
      },
    },
    async () => {
      const methods = await identityService.listMethods();
      return { data: methods };
    },
  );

  fastify.post(
    "/auth/logout",
    {
      schema: {
        tags: ["auth"],
        security: [{ bearer: [] }],
        auth: {
          require: true,
        },
      },
      preHandler: AuthnHook,
    },
    async (request) => {
      try {
        await identityService.revokeToken(request.user.token, "session");
      } catch (e) {
        logger.debug("failed to revoke session token", e);
      }
      return {};
    },
  );
}
