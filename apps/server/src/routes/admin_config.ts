import { Service } from "@noctf/server-core";

export async function routes(fastify: Service) {
  const { configService } = fastify.container.cradle;

  fastify.get("/admin/config", () => ({ data: configService.getSchemas() }));
  fastify.get<{
    Params: {
      namespace: string;
    };
  }>("/admin/config/:namespace", async (request) => {
    return {
      data: await configService.get(request.params.namespace, false),
    };
  });
  fastify.put<{
    Params: {
      namespace: string;
    };
  }>("/admin/config/:namespace", async (request) => {
    return {
      data: await configService.get(request.params.namespace, false),
    };
  });
}
