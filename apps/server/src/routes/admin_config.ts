import { UpdateConfigValueRequest } from "@noctf/api/requests";
import { GetAdminConfigValueResponse } from "@noctf/api/responses";
import { AuthHook } from "@noctf/server-core/hooks/auth";
import { AuthzFlagHook } from "@noctf/server-core/hooks/authz";
import { UserFlag } from "@noctf/server-core/types/enums";
import { ActorType } from "@noctf/server-core/types/enums";
import { FastifyInstance } from "fastify";

export async function routes(fastify: FastifyInstance) {
  const { configService } = fastify.container.cradle;

  fastify.addHook("preHandler", AuthHook(UserFlag.ADMIN));
  fastify.addHook("preHandler", AuthzFlagHook(UserFlag.ADMIN));

  fastify.get(
    "/admin/config",
    {
      schema: {
        tags: ["admin"],
        security: [{ bearer: [] }],
      },
    },
    () => ({ data: configService.getSchemas() }),
  );
  fastify.get<{
    Params: {
      namespace: string;
    };
    Reply: GetAdminConfigValueResponse;
  }>(
    "/admin/config/:namespace",
    {
      schema: {
        tags: ["admin"],
        security: [{ bearer: [] }],
        response: {
          200: GetAdminConfigValueResponse,
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
          id: request.user,
        },
      });
      return {
        data,
      };
    },
  );
}
