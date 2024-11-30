import { Service } from "@noctf/server-core";

export default async function (fastify: Service) {
  await fastify.container.cradle.configService.register("core.setup", {
    initialized: false,
  });
}
