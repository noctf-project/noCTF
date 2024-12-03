import { Service } from "@noctf/server-core";
import { Static, Type } from "@sinclair/typebox";

const Config = Type.Object({
  initialized: Type.Boolean({
    title: "Initialized (cannot be changed)",
  }),
});

export async function initServer(fastify: Service) {
  const { configService } = fastify.container.cradle;
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
