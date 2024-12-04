import { ServiceCradle } from "@noctf/server-core";
import { Static, Type } from "@sinclair/typebox";
import { FastifyInstance } from "fastify";

const Config = Type.Object({
  initialized: Type.Boolean({
    title: "Initialized (cannot be changed)",
  }),
});

export async function initServer(fastify: FastifyInstance) {
  const { configService } = fastify.container.cradle as ServiceCradle;
  await configService.register<Static<typeof Config>>(
    "core.setup",
    Config,
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
