import { UpdateConfigValueRequest } from "@noctf/api/requests";
import {
  AdminGetConfigValueResponse,
  AdminGetConfigSchemaResponse,
} from "@noctf/api/responses";
import { ActorType } from "@noctf/server-core/types/enums";
import type { FastifyInstance } from "fastify";
import "@noctf/server-core/types/fastify";
import type { Policy } from "@noctf/server-core/util/policy";

export async function routes(fastify: FastifyInstance) {
  const { configService } = fastify.container.cradle;

  const auth = {
    require: true,
    scopes: new Set(["admin"]),
    policy: ["admin.config"] as Policy,
  };

  fastify.get(
    "/admin/config",
    {
      schema: {
        tags: ["admin"],
        security: [{ bearer: [] }],
        auth,
        response: {
          200: AdminGetConfigSchemaResponse,
        },
      },
    },
    () => ({ data: configService.getSchemas() }),
  );

  fastify.get<{
    Params: {
      namespace: string;
    };
    Reply: AdminGetConfigValueResponse;
  }>(
    "/admin/config/:namespace",
    {
      schema: {
        tags: ["admin"],
        security: [{ bearer: [] }],
        auth,
        response: {
          200: AdminGetConfigValueResponse,
        },
      },
    },
    async (request) => {
      return {
        data: await configService.get(request.params.namespace, true),
      };
    },
  );
  fastify.put<{
    Params: {
      namespace: string;
    };
    Body: UpdateConfigValueRequest;
  }>(
    "/admin/config/:namespace",
    {
      schema: {
        tags: ["admin"],
        security: [{ bearer: [] }],
        body: UpdateConfigValueRequest,
        auth: {
          ...auth,
          policy: ["admin.config.update"],
        },
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
