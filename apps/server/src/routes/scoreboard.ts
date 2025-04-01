import type { ServiceCradle } from "@noctf/server-core";
import type { FastifyInstance } from "fastify";
import "@noctf/server-core/types/fastify";
import {
  ScoreboardResponse,
  ScoreboardTeamResponse,
} from "@noctf/api/responses";
import { GetTeamParams } from "@noctf/api/params";
import { NotFoundError } from "@noctf/server-core/errors";
import { ScoreboardQuery } from "@noctf/api/query";

export const SCOREBOARD_PAGE_SIZE = 400;

export async function routes(fastify: FastifyInstance) {
  const { scoreboardService, challengeService, teamService } = fastify.container
    .cradle as ServiceCradle;

  fastify.get<{ Reply: ScoreboardResponse; Querystring: ScoreboardQuery }>(
    "/scoreboard",
    {
      schema: {
        security: [{ bearer: [] }],
        tags: ["scoreboard"],
        auth: {
          require: true,
          policy: ["scoreboard.get"],
        },
        querystring: ScoreboardQuery,
        response: {
          200: ScoreboardResponse,
        },
      },
    },
    async (request) => {
      const page = request.query.page || 1;

      // TODO: get scoreboard by division, currently we only have 1 div
      const scoreboard = await scoreboardService.getScoreboard(1);

      return {
        data: {
          scores:
            scoreboard?.data.slice(
              (page - 1) * SCOREBOARD_PAGE_SIZE,
              page * SCOREBOARD_PAGE_SIZE,
            ) || [],
          page_size: SCOREBOARD_PAGE_SIZE,
          total: scoreboard?.data.length || 0,
        },
      };
    },
  );

  fastify.get<{ Params: GetTeamParams; Reply: ScoreboardTeamResponse }>(
    "/scoreboard/team/:id",
    {
      schema: {
        security: [{ bearer: [] }],
        tags: ["scoreboard"],
        params: GetTeamParams,
        response: {
          200: ScoreboardTeamResponse,
        },
        auth: {
          require: true,
          policy: ["AND", "team.get", "scoreboard.get"],
        },
      },
    },
    async (request) => {
      const team = await teamService.get(request.params.id);
      if (!team || team.flags.includes("hidden")) {
        throw new NotFoundError("Team not found");
      }
      const now = Date.now();
      const challenges = await challengeService.list(
        { hidden: false, visible_at: new Date(now + 60000) },
        {
          cacheKey: "route:/teams",
          removePrivateTags: true,
        },
      );
      // TODO: get scoreboard by division, currently we only have 1 div
      const scores = (await scoreboardService.getChallengeScores(1)).data;
      const graph = await scoreboardService.getTeamScoreHistory(
        request.params.id,
      );
      const solves = challenges
        .map(({ id }) => {
          const s = scores[id]?.solves.find(
            ({ team_id }) => team_id === team.id,
          );
          return s && !s.hidden && { ...s, challenge_id: id };
        })
        .filter((x) => x);
      return {
        data: { solves, graph },
      };
    },
  );
}
