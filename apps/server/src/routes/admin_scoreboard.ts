import type { FastifyInstance } from "fastify";
import { BaseResponse } from "@noctf/api/responses";
import { AdminScoreboardTriggerRequest } from "@noctf/api/requests";
import { ScoreboardTriggerEvent } from "@noctf/api/events";

export async function routes(fastify: FastifyInstance) {
  const { eventBusService } = fastify.container.cradle;
  fastify.post<{ Body: AdminScoreboardTriggerRequest }>(
    "/admin/scoreboard/trigger",
    {
      schema: {
        security: [{ bearer: [] }],
        tags: ["admin"],
        auth: {
          require: true,
          policy: ["admin.scoreboard.trigger"],
        },
        body: AdminScoreboardTriggerRequest,
        response: {
          200: BaseResponse,
        },
      },
    },
    async (request) => {
      const { recompute_graph } = request.body;
      await eventBusService.publish(ScoreboardTriggerEvent, {
        recompute_graph,
      });
      return {};
    },
  );
}
