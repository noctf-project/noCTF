import type { FastifyInstance } from "fastify";
import {
  AdminExportScoreboardCTFTimeResponse,
  BaseResponse,
} from "@noctf/api/responses";
import { AdminScoreboardTriggerRequest } from "@noctf/api/requests";
import { ScoreboardTriggerEvent } from "@noctf/api/events";
import { IdParams } from "@noctf/api/params";
import { GetRouteUserIPKey } from "@noctf/server-core/util/limit_keys";
import { SetupConfig } from "@noctf/api/config";
import { NotFoundError } from "@noctf/server-core/errors";

export async function routes(fastify: FastifyInstance) {
  const { configService, eventBusService, scoreboardService, teamService } =
    fastify.container.cradle;
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

  fastify.post<{
    Params: IdParams;
    Response: AdminExportScoreboardCTFTimeResponse;
  }>(
    "/admin/scoreboard/ctftime/:id",
    {
      schema: {
        security: [{ bearer: [] }],
        tags: ["admin"],
        // auth maybe not required since we may want to allow ctftime to query
        auth: {
          policy: ["admin.scoreboard.export.ctftime"],
        },
        rateLimit: (r) => [
          {
            key: GetRouteUserIPKey(r),
            limit: 10,
            windowSeconds: 60,
          },
        ],
        params: IdParams,
        response: {
          200: AdminExportScoreboardCTFTimeResponse,
        },
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
