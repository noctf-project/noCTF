import { AdminScoreboardTrigger } from "@noctf/api/contract/admin_scoreboard";
import { ScoreboardTriggerEvent } from "@noctf/api/events";
import { route } from "@noctf/server-core/util/route";
import type { FastifyInstance } from "fastify";

export async function routes(fastify: FastifyInstance) {
  const { eventBusService } = fastify.container.cradle;
  route(
    fastify,
    AdminScoreboardTrigger,
    {
      auth: {
        require: true,
        policy: ["admin.scoreboard.trigger"],
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
