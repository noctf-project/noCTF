import { ServiceCradle } from "@noctf/server-core";
import { FastifyInstance } from "fastify";
import { AuthnHook } from "@noctf/server-core/hooks/authn";
import { DEFAULT_CONFIG, TicketConfig } from "./schema/config.ts";
import { OpenTicketRequest, OpenTicketResponse } from "./schema/api.ts";
import "@noctf/server-core/types/fastify";

export async function initServer(fastify: FastifyInstance) {
  const { configService } = fastify.container.cradle as ServiceCradle;
  await configService.register<TicketConfig>(TicketConfig, DEFAULT_CONFIG);

  fastify.addHook("preHandler", AuthnHook);

  fastify.post<{ Request: OpenTicketRequest; Reply: OpenTicketResponse }>(
    "/tickets",
    {
      schema: {
        tags: ["tickets"],
        security: [{ bearer: [] }],
        body: OpenTicketRequest,
        auth: {
          require: true,
        },
        response: {
          "2xx": OpenTicketResponse,
        },
      },
    },
    async () => {
      return {
        data: {
          id: 0,
        },
      };
    },
  );
}
