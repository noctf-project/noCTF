import { SetupConfig, TeamConfig } from "@noctf/api/config";
import type { FastifyInstance } from "fastify";

export async function register(fastify: FastifyInstance) {
  const { configService } = fastify.container.cradle;

  await configService.register<TeamConfig>(TeamConfig, {
    max_members: 0,
  });

  await configService.register<SetupConfig>(
    SetupConfig,
    {
      initialized: false,
      active: false,
    },
    ({ initialized }) => {
      if (!initialized) {
        return "cannot set intialized to false";
      }
    },
  );
}
