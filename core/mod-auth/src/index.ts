import fastifyCookie from "@fastify/cookie";
import type { ListAuthMethodsResponse } from "@noctf/api/responses";
import { DEFAULT_CONFIG } from "./const.ts";
import password_routes from "./password_routes.ts";
import oauth_routes from "./oauth_routes.ts";
import register_routes from "./register_routes.ts";
import type { FastifyInstance } from "fastify/types/instance.js";
import { AuthConfig } from "@noctf/api/config";
import "@noctf/server-core/types/fastify";

export async function initServer(fastify: FastifyInstance) {
  const { identityService, configService, logger } = fastify.container.cradle;
  await configService.register(AuthConfig, DEFAULT_CONFIG);
  fastify.register(fastifyCookie);
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
