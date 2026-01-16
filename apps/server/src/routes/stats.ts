import { SetupConfig } from "@noctf/api/config";
import { GetChallengeStats, GetUserStats } from "@noctf/api/contract/stats";
import { BadRequestError, NotFoundError } from "@noctf/server-core/errors";
import { route } from "@noctf/server-core/util/route";
import { FastifyInstance } from "fastify";
import { GetUtils } from "./_util.ts";

export async function routes(fastify: FastifyInstance) {
  const { configService, divisionService, statsService } =
    fastify.container.cradle;
  const { gateStartTime } = GetUtils(fastify.container.cradle);

  route(
    fastify,
    GetUserStats,
    {
      auth: {
        policy: ["stats.user"],
      },
    },
    async () => {
      const stats = await statsService.getUserStats();
      return {
        data: stats,
      };
    },
  );

  route(
    fastify,
    GetChallengeStats,
    {
      auth: {
        policy: ["stats.challenge"],
      },
    },
    async (request) => {
      const ctime = Date.now();
      const admin = await gateStartTime(
        ["admin.challenge.get"],
        ctime,
        request.user?.id,
      );

      let division = request.query.division_id;
      const membership = await request.user?.membership;
      if (division && !admin && membership?.division_id !== division) {
        const cfg = await divisionService.get(division);
        if (!cfg.is_visible) throw new NotFoundError("Division not found");
      }
      if (!division) {
        division =
          membership?.division_id ||
          (await configService.get(SetupConfig)).value.default_division_id;
      }
      if (!division) {
        throw new BadRequestError(
          "Cannot infer division from your membership or query",
        );
      }

      const stats = await statsService.getChallengeStats(division);

      return {
        data: {
          entries: stats.filter(
            ({ released_at, hidden }) =>
              admin ||
              (!hidden && (released_at ? ctime > released_at.getTime() : true)),
          ),
          division_id: division,
        },
      };
    },
  );
}
