import { SetupConfig } from "@noctf/api/config";
import { GetSiteConfigResponse } from "@noctf/api/responses";
import { ServiceCradle } from "@noctf/server-core";
import { FastifyInstance } from "fastify";

export async function routes(fastify: FastifyInstance) {
  const { configService } = fastify.container.cradle as ServiceCradle;

  fastify.get<{ Reply: GetSiteConfigResponse }>(
    "/site/config",
    {
      schema: {
        tags: ["site"],
        security: [{ bearer: [] }],
        response: {
          200: GetSiteConfigResponse,
        },
      },
    },
    async () => {
      return {
        data: (await configService.get<SetupConfig>(SetupConfig.$id)).value,
      };
    },
  );
}
