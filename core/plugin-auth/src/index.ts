import { Service } from "@noctf/server-core";
import { AuthListMethodsResponse } from "@noctf/api/responses";
import { CONFIG_NAMESPACE, Config, DEFAULT_CONFIG } from "./config.ts";
import password_routes from "./password_routes.ts";
import oauth_routes from "./oauth_routes.ts";
import register_routes from "./register_routes.ts";

declare module "fastify" {
  interface FastifySchema {
    tags?: string[];
    description?: string;
  }
}

export default async function (fastify: Service) {
  const { identityService, configService } = fastify.container.cradle;
  await configService.register(CONFIG_NAMESPACE, Config, DEFAULT_CONFIG);
  fastify.register(oauth_routes);
  fastify.register(password_routes);
  fastify.register(register_routes);

  fastify.get<{
    Reply: AuthListMethodsResponse;
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
}
