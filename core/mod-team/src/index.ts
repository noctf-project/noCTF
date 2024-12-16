import { ServiceCradle } from "@noctf/server-core";
import { FastifyInstance } from "fastify";
import { TeamConfig } from "@noctf/api/config";
import "@noctf/server-core/types/fastify";

export async function initServer(fastify: FastifyInstance) {
  const { configService } = fastify.container.cradle as ServiceCradle;
  await configService.register<TeamConfig>(TeamConfig, {
    max_members: 0,
  });

  fastify.post(
    "/team",
    {
      schema: {
        security: [{ bearer: [] }],
        tags: ["team"],
        auth: {
          require: true,
        },
      },
    },
    async () => {
      return "good";
    },
  );
}
