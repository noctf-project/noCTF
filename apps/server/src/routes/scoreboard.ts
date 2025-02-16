import type { ServiceCradle } from "@noctf/server-core";
import type { FastifyInstance } from "fastify";
import "@noctf/server-core/types/fastify";
import {
  ScoreboardResponse,
  ScoreboardSolvesResponse,
} from "@noctf/api/responses";

export async function routes(fastify: FastifyInstance) {
  const { scoreboardService } = fastify.container.cradle as ServiceCradle;

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
    async () => {
      const { scoreboard } = await scoreboardService.getScoreboard();
      return {
        data: scoreboard,
      };
    },
  );

  fastify.get<{ Reply: ScoreboardSolvesResponse }>(
    "/solves",
    {
      schema: {
        security: [{ bearer: [] }],
        tags: ["scoreboard"],
        auth: {
          require: true,
          policy: ["scoreboard.solves.get"],
        },
        response: {
          200: ScoreboardSolvesResponse,
        },
      },
    },
    async () => {
      const { solves } = await scoreboardService.getScoreboard();
      return {
        data: solves,
      };
    },
  );
}
