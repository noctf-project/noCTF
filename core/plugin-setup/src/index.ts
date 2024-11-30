import { Service } from "@noctf/server-core";
import { Type } from "@sinclair/typebox";

const Config = Type.Object({
  initialized: Type.Boolean({
    title: "Initialized (cannot be changed)",
  }),
});

export default async function (fastify: Service) {
  await fastify.container.cradle.configService.register("core.setup", Config, {
    initialized: false,
  });
}
