import { ServiceCradle } from "@noctf/server-core";
import { SetupConfig } from "@noctf/api/config";
import { FastifyInstance } from "fastify";

export async function initServer(fastify: FastifyInstance) {
  const { configService } = fastify.container.cradle as ServiceCradle;
  await configService.register<SetupConfig>(
    SetupConfig,
    {
      initialized: false,
    },
    ({ initialized }) => {
      if (!initialized) {
        return "cannot set intialized to false";
      }
    },
  );
}
