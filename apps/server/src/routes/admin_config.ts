import {
  AdminGetConfigSchema,
  AdminGetConfigValue,
  AdminUpdateConfigValue,
} from "@noctf/api/contract/admin_config";
import { ActorType } from "@noctf/server-core/types/enums";
import "@noctf/server-core/types/fastify";
import { route } from "@noctf/server-core/util/route";
import type { FastifyInstance } from "fastify";

export async function routes(fastify: FastifyInstance) {
  const { configService } = fastify.container.cradle;

  route(
    fastify,
    AdminGetConfigSchema,
    {
      auth: { require: true, policy: ["admin.config.get"] },
    },
    () => ({ data: configService.getSchemas() }),
  );

  route(
    fastify,
    AdminGetConfigValue,
    {
      auth: { require: true, policy: ["admin.config.get"] },
    },
    async (request) => {
      return {
        data: await configService.get(request.params.namespace, true),
      };
    },
  );
  route(
    fastify,
    AdminUpdateConfigValue,
    {
      auth: {
        require: true,
        policy: ["admin.config.update"],
      },
    },
    async (request) => {
      const { value, version } = request.body;
      const data = await configService.update({
        namespace: request.params.namespace,
        value,
        version,
        actor: {
          type: ActorType.USER,
          id: request.user?.id,
        },
      });
      return {
        data,
      };
    },
  );
}
