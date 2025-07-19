import type { ServiceCradle } from "@noctf/server-core";
import type { FastifyInstance, FastifyRequest } from "fastify";
import "@noctf/server-core/types/fastify";
import {
  ScoreboardGraphsResponse,
  ScoreboardResponse,
  ScoreboardTeamResponse,
} from "@noctf/api/responses";
import { IdParams } from "@noctf/api/params";
import { NotFoundError } from "@noctf/server-core/errors";
import { ScoreboardQuery, ScoreboardTagsQuery } from "@noctf/api/query";
import { GetUtils } from "./_util.ts";
import { Policy } from "@noctf/server-core/util/policy";
import { WindowDeltaedTimeSeriesPoints } from "@noctf/server-core/util/graph";

export const SCOREBOARD_PAGE_SIZE = 50;

export async function routes(fastify: FastifyInstance) {
  const { scoreboardService, teamService, divisionService } = fastify.container
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
      const id = request.params.id;
      if (!admin && id !== (await request.user?.membership)?.division_id) {
        const division = await divisionService.get(id);
        if (!division?.is_visible)
          throw new NotFoundError("Division not found");
      }

      const page = request.query.page || 1;
      const page_size =
        (admin
          ? request.query.page_size
          : Math.min(SCOREBOARD_PAGE_SIZE, request.query.page_size)) ||
        SCOREBOARD_PAGE_SIZE;
      const scoreboard = await scoreboardService.getScoreboard(
        id,
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
    Querystring: ScoreboardTagsQuery;
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
        querystring: ScoreboardTagsQuery,
        params: IdParams,
        response: {
          200: ScoreboardGraphsResponse,
        },
      },
    },
    async (request) => {
      const admin = await gateStartTime(
        adminPolicy,
        Date.now(),
        request.user?.id,
      );
      const id = request.params.id;
      if (!admin && id !== (await request.user?.membership)?.division_id) {
        const division = await divisionService.get(id);
        if (!division?.is_visible)
          throw new NotFoundError("Division not found");
      }
      const graphs = await scoreboardService.getTopScoreHistory(
        request.params.id,
        10,
        request.query.tags,
      );
      return {
        data: graphs.map((g) => ({
          ...g,
          graph: WindowDeltaedTimeSeriesPoints(
            g.graph,
            request.query.graph_interval || 1,
          ),
        })),
      };
    },
  );

  fastify.get<{
    Params: IdParams;
    Querystring: ScoreboardTagsQuery;
    Reply: ScoreboardTeamResponse;
  }>(
    "/scoreboard/teams/:id",
    {
      schema: {
        security: [{ bearer: [] }],
        tags: ["scoreboard"],
        querystring: ScoreboardTagsQuery,
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
      const admin = await gateStartTime(adminPolicy, ctime, request.user?.id);

      const team = await teamService.get(request.params.id);
      const membership = await request.user?.membership;
      const showHidden = membership?.team_id === request.params.id || admin;
      if (!team || (team.flags.includes("hidden") && !showHidden)) {
        throw new NotFoundError("Team not found");
      }
      if (!showHidden) {
        const division = await divisionService.get(team.division_id);
        if (!division?.is_visible) throw new NotFoundError("Team not found");
      }
      const entry = await scoreboardService.getTeam(team.division_id, team.id);
      if (!entry) {
        throw new NotFoundError("Team not found");
      }
      if (request.query.tags) {
        const rank = await scoreboardService.getTeamRank(
          team.division_id,
          team.id,
          request.query.tags,
        );
        if (rank == null) {
          throw new NotFoundError("Team not found");
        }
        entry.rank = rank;
      }
      const graph = await scoreboardService.getTeamScoreHistory(
        request.params.id,
      );
      const solves = showHidden
        ? entry.solves
        : entry.solves.filter(({ hidden }) => !hidden);
      return {
        data: {
          ...entry,
          solves,
          graph: WindowDeltaedTimeSeriesPoints(
            graph,
            request.query.graph_interval || 1,
          ),
        },
      };
    },
  );
}
