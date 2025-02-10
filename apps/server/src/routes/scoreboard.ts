import type { ServiceCradle } from "@noctf/server-core";
import type { FastifyInstance } from "fastify";
import "@noctf/server-core/types/fastify";
import { ScoreboardResponse } from "@noctf/api/responses";
import { CACHE_SCORE_NAMESPACE } from "@noctf/server-core/services/scoreboard";

export async function routes(fastify: FastifyInstance) {
  const { cacheService, scoreboardService } = fastify.container
    .cradle as ServiceCradle;

  fastify.get<{ Reply: ScoreboardResponse }>(
    "/scoreboard",
    {
      schema: {
        security: [{ bearer: [] }],
        tags: ["scoreboard"],
        auth: {
          require: true,
          policy: ["scoreboard.get"],
        },
        response: {
          200: ScoreboardResponse,
        },
      },
    },
    async (_request) => {
      const scoreboard = await cacheService.load(
        CACHE_SCORE_NAMESPACE,
        "scoreboard",
        async () => {
          return scoreboardService.computeScoreboard();
        },
      );
      return {
        data: scoreboard,
      };
    },
  );
}
