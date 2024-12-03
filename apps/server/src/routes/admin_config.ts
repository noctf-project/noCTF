import { UpdateAdminConfigValueRequest } from "@noctf/api/requests";
import { GetAdminConfigValueResponse } from "@noctf/api/responses";
import { Service } from "@noctf/server-core";

export async function routes(fastify: Service) {
  const { configService } = fastify.container.cradle;

  fastify.get("/admin/config", () => ({ data: configService.getSchemas() }));
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
    Body: UpdateAdminConfigValueRequest;
  }>(
    "/admin/config/:namespace",
    {
      schema: {
        tags: ["admin"],
        body: UpdateAdminConfigValueRequest,
      },
    },
    async (request) => {
      return {
        data: await configService.update(
          request.params.namespace,
          request.body.value,
          request.body.version,
        ),
      };
    },
  );
}
