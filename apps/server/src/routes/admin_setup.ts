import { SetupConfig } from "@noctf/api/config";
import type { FastifyInstance } from "fastify";

// TODO
export async function routes(fastify: FastifyInstance) {
  const { configService } = fastify.container.cradle;
  await configService.register(
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
