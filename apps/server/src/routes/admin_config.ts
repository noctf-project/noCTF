import { UpdateConfigValueRequest } from "@noctf/api/requests";
import { GetAdminConfigValueResponse } from "@noctf/api/responses";
import { AuthHook } from "@noctf/server-core/hooks/authn";
import { ActorType } from "@noctf/server-core/types/enums";
import { FastifyInstance } from "fastify";
import "@noctf/server-core/types/fastify";


export async function routes(fastify: FastifyInstance) {
  const { configService } = fastify.container.cradle;

  const auth = {
    require: true,
    scopes: new Set(["admin"])
  };

  fastify.addHook("preHandler", AuthHook);

  fastify.get(
    "/admin/config",
    {
      schema: {
        tags: ["admin"],
        security: [{ bearer: [] }],
        auth
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
        auth,
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
        auth,
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
