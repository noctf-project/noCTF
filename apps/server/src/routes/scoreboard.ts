import type { ServiceCradle } from "@noctf/server-core";
import type { FastifyInstance } from "fastify";
import "@noctf/server-core/types/fastify";
import {
  ScoreboardExportCTFTimeResponse,
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
import { GetRouteUserIPKey } from "@noctf/server-core/util/limit_keys";
import { SetupConfig } from "@noctf/api/config";

export const SCOREBOARD_PAGE_SIZE = 50;

export async function routes(fastify: FastifyInstance) {
  const { scoreboardService, teamService, divisionService, configService } =
    fastify.container.cradle as ServiceCradle;

  const { gateStartTime, getMaxPageSize } = GetUtils(fastify.container.cradle);
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
        querystring: ScoreboardQuery,
        params: IdParams,
        response: {
          200: ScoreboardResponse,
        },
      },
      config: {
        auth: {
          policy: ["scoreboard.get"],
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
      const page_size = Math.min(
        request.query.page_size || SCOREBOARD_PAGE_SIZE,
        await getMaxPageSize(
          ["bypass.page_size.scoreboard"],
          request.user?.id,
          SCOREBOARD_PAGE_SIZE,
        ),
      );

      const scoreboard = await scoreboardService.getScoreboard(
        id,
        (page - 1) * page_size,
        page * page_size - 1,
        request.query.tags,
      );
      const graphs = request.query.graph_interval
        ? await scoreboardService.getTeamScoreHistory(
            scoreboard.entries.map(({ team_id }) => team_id),
          )
        : new Map();

      const entries = scoreboard.entries.map((e) => ({
        ...e,
        solves: admin ? e.solves : e.solves.filter((x) => !x.hidden),
        graph: WindowDeltaedTimeSeriesPoints(
          graphs.get(e.team_id),
          request.query.graph_interval || 1,
        ),
      }));

      return {
        data: {
          entries,
          page_size: page_size,
          total: scoreboard.total,
        },
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
      },
      config: {
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
      const graph = await scoreboardService.getTeamScoreHistory([
        request.params.id,
      ]);
      const solves = showHidden
        ? entry.solves
        : entry.solves.filter(({ hidden }) => !hidden);
      return {
        data: {
          ...entry,
          solves,
          graph: WindowDeltaedTimeSeriesPoints(
            graph.get(request.params.id) || [[], []],
            request.query.graph_interval || 1,
          ),
        },
      };
    },
  );

  fastify.get<{
    Params: IdParams;
    Response: ScoreboardExportCTFTimeResponse;
  }>(
    "/scoreboard/divisions/:id/ctftime",
    {
      schema: {
        security: [{ bearer: [] }],
        tags: ["scoreboard"],
        params: IdParams,
        response: {
          200: ScoreboardExportCTFTimeResponse,
        },
      },
      config: {
        auth: {
          policy: ["scoreboard.get.ctftime"],
        },
        rateLimit: (r) => [
          {
            key: GetRouteUserIPKey(r),
            limit: 10,
            windowSeconds: 60,
          },
        ],
      },
    },
    async (request) => {
      const { value } = await configService.get(SetupConfig);
      if (
        value.ctftime_division_ids &&
        value.ctftime_division_ids.length &&
        !value.ctftime_division_ids.includes(request.params.id)
      ) {
        throw new NotFoundError("Division not found");
      }

      const scoreboardPromise = scoreboardService.getScoreboard(
        request.params.id,
        0,
        Number.MAX_SAFE_INTEGER,
      );
      const teamsPromise = teamService.listNames({
        flags: ["!hidden"],
        division_id: request.params.id,
      });
      const [scoreboard, teams] = await Promise.all([
        scoreboardPromise,
        teamsPromise,
      ]);
      const teamMap = new Map(teams.map(({ id, name }) => [id, name]));
      return {
        standings: scoreboard.entries.map((x, i) => ({
          pos: i + 1,
          team: teamMap.get(x.team_id) || `unknown-${x.team_id}`,
          score: x.score,
        })),
      };
    },
  );
}
