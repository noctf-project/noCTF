import { SetupConfig } from "@noctf/api/config";
import { GetSiteConfigResponse } from "@noctf/api/responses";
import { ServiceCradle } from "@noctf/server-core";
import { Type } from "@sinclair/typebox";
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
        data: (await configService.get(SetupConfig)).value,
      };
    },
  );

  fastify.get<{ Reply: { status: "OK" } }>(
    "/healthz",
    {
      schema: {
        tags: ["site"],
        security: [{ bearer: [] }],
        response: {
          200: Type.Object({ status: Type.Literal("OK") }),
        },
      },
    },
    async () => {
      return { status: "OK" };
    },
  );
}
