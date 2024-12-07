import { ServiceCradle } from "@noctf/server-core";
import { FastifyInstance } from "fastify";
import { TeamConfig } from "@noctf/api/config";
import { AuthHook } from "@noctf/server-core/hooks/authn";
import "@noctf/server-core/types/fastify";

declare module "fastify" {
  interface FastifySchema {
    tags?: string[];
    description?: string;
  }
}

export async function initServer(fastify: FastifyInstance) {
  const { configService } = fastify.container.cradle as ServiceCradle;
  await configService.register<TeamConfig>(TeamConfig, {
    allow_registration: true,
    allow_joining: true,
    restrict_valid_email: false,
  });

  fastify.addHook("preHandler", AuthHook);

  fastify.post(
    "/team",
    {
      schema: {
        security: [{ bearer: [] }],
        tags: ["team"],
        auth: {
          require: true
        }
      },
    },
    async () => {
      return "good";
    },
  );
}
