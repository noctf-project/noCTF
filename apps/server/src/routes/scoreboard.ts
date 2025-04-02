import type { ServiceCradle } from "@noctf/server-core";
import type { FastifyInstance } from "fastify";
import "@noctf/server-core/types/fastify";
import {
  ScoreboardResponse,
  ScoreboardTeamResponse,
} from "@noctf/api/responses";
import { IdParams } from "@noctf/api/params";
import { NotFoundError } from "@noctf/server-core/errors";
import { ScoreboardQuery } from "@noctf/api/query";
import { GetUtils } from "./_util.ts";
import { Policy } from "@noctf/server-core/util/policy";
import { Award } from "@noctf/api/datatypes";

export const SCOREBOARD_PAGE_SIZE = 200;

export async function routes(fastify: FastifyInstance) {
  const { scoreboardService, challengeService, teamService } = fastify.container
    .cradle as ServiceCradle;

  const { gateStartTime } = GetUtils(fastify.container.cradle);
  const adminPolicy: Policy = ["admin.scoreboard.get"];

  fastify.get<{
    Reply: ScoreboardResponse;
    Querystring: ScoreboardQuery;
    Params: IdParams;
  }>(
    "/scoreboard/division/:id",
    {
      schema: {
        security: [{ bearer: [] }],
        tags: ["scoreboard"],
        auth: {
          require: true,
          policy: ["scoreboard.get"],
        },
        querystring: ScoreboardQuery,
        params: IdParams,
        response: {
          200: ScoreboardResponse,
        },
      },
    },
    async (request) => {
      const ctime = Date.now();
      const admin = await gateStartTime(adminPolicy, ctime, request.user?.id);

      const page = request.query.page || 1;
      const page_size =
        (admin
          ? request.query.page_size
          : Math.min(SCOREBOARD_PAGE_SIZE, request.query.page_size)) ||
        SCOREBOARD_PAGE_SIZE;
      const scoreboard = await scoreboardService.getScoreboard(
        request.params.id,
      );

      return {
        data: {
          scores:
            scoreboard?.data.slice((page - 1) * page_size, page * page_size) ||
            [],
          page_size: page_size,
          total: scoreboard?.data.length || 0,
          updated_at: scoreboard?.updated_at,
        },
      };
    },
  );

  fastify.get<{ Params: IdParams; Reply: ScoreboardTeamResponse }>(
    "/scoreboard/team/:id",
    {
      schema: {
        security: [{ bearer: [] }],
        tags: ["scoreboard"],
        params: IdParams,
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
      const ctime = Date.now();
      await gateStartTime(adminPolicy, ctime, request.user?.id);

      const team = await teamService.get(request.params.id);
      if (!team || team.flags.includes("hidden")) {
        throw new NotFoundError("Team not found");
      }
      const now = Date.now();
      const challenges = new Set(
        (
          await challengeService.list(
            { hidden: false, visible_at: new Date(now + 60000) },
            {
              cacheKey: "route:/teams",
              removePrivateTags: true,
            },
          )
        ).map(({ id }) => id),
      );
      const [scores, teamSolves, awards] = await Promise.all([
        scoreboardService.getChallengesSummary(team.division_id),
        scoreboardService.getTeamSolves(team.id),
        scoreboardService.getTeamAwards(team.id),
      ]);
      const graph = await scoreboardService.getTeamScoreHistory(
        request.params.id,
      );
      const solves = teamSolves
        .filter(({ challenge_id }) => challenges.has(challenge_id))
        .filter(({ hidden }) => !hidden)
        .map(({ challenge_id, ...x }) => ({
          ...x,
          challenge_id,
          score: scores.data[challenge_id].score,
        }));
      return {
        data: { solves, graph, awards },
      };
    },
  );
}
