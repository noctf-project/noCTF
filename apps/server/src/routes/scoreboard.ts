import type { ServiceCradle } from "@noctf/server-core";
import type { FastifyInstance } from "fastify";
import "@noctf/server-core/types/fastify";
import {
  ScoreboardGraphsResponse,
  ScoreboardResponse,
  ScoreboardTeamResponse,
} from "@noctf/api/responses";
import { IdParams } from "@noctf/api/params";
import { NotFoundError } from "@noctf/server-core/errors";
import { ScoreboardQuery, ScoreboardTopQuery } from "@noctf/api/query";
import { GetUtils } from "./_util.ts";
import { Policy } from "@noctf/server-core/util/policy";

export const SCOREBOARD_PAGE_SIZE = 50;

export async function routes(fastify: FastifyInstance) {
  const { scoreboardService, teamService } = fastify.container
    .cradle as ServiceCradle;

  const { gateStartTime } = GetUtils(fastify.container.cradle);
  const adminPolicy: Policy = ["admin.scoreboard.get"];

  fastify.get<{
    Reply: ScoreboardResponse;
    Querystring: ScoreboardQuery;
    Params: IdParams;
  }>(
    "/scoreboard/divisions/:id",
    {
      schema: {
        security: [{ bearer: [] }],
        tags: ["scoreboard"],
        auth: {
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
      const admin = await gateStartTime(
        adminPolicy,
        Date.now(),
        request.user?.id,
      );

      const page = request.query.page || 1;
      const page_size =
        (admin
          ? request.query.page_size
          : Math.min(SCOREBOARD_PAGE_SIZE, request.query.page_size)) ||
        SCOREBOARD_PAGE_SIZE;
      const scoreboard = await scoreboardService.getScoreboard(
        request.params.id,
        (page - 1) * page_size,
        page * page_size - 1,
        request.query.tags,
      );
      return {
        data: {
          scores: scoreboard.entries,
          page_size: page_size,
          total: scoreboard.total,
        },
      };
    },
  );

  fastify.get<{
    Reply: ScoreboardGraphsResponse;
    Querystring: ScoreboardTopQuery;
    Params: IdParams;
  }>(
    "/scoreboard/divisions/:id/top",
    {
      schema: {
        security: [{ bearer: [] }],
        tags: ["scoreboard"],
        auth: {
          policy: ["scoreboard.get"],
        },
        querystring: ScoreboardTopQuery,
        params: IdParams,
        response: {
          200: ScoreboardGraphsResponse,
        },
      },
    },
    async (request) => {
      await gateStartTime(adminPolicy, Date.now(), request.user?.id);
      const graphs = await scoreboardService.getTopScoreHistory(
        request.params.id,
        10,
        request.query.tags,
      );
      return {
        data: graphs,
      };
    },
  );

  fastify.get<{ Params: IdParams; Reply: ScoreboardTeamResponse }>(
    "/scoreboard/teams/:id",
    {
      schema: {
        security: [{ bearer: [] }],
        tags: ["scoreboard"],
        params: IdParams,
        response: {
          200: ScoreboardTeamResponse,
        },
        auth: {
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
      const entry = await scoreboardService.getTeam(team.division_id, team.id);
      const graph = await scoreboardService.getTeamScoreHistory(
        request.params.id,
      );
      if (!entry) {
        throw new NotFoundError("Team not found");
      }
      const solves = entry.solves.filter(({ hidden }) => !hidden);
      return {
        data: {
          ...entry,
          solves,
          graph,
        },
      };
    },
  );
}
