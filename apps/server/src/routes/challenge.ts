import { SetupConfig } from "@noctf/api/config";
import {
  GetChallenge,
  GetChallengeSolves,
  ListChallenges,
  SolveChallenge,
} from "@noctf/api/contract/challenge";
import { IdParams } from "@noctf/api/params";
import { BaseResponse } from "@noctf/api/responses";
import { ForbiddenError, NotFoundError } from "@noctf/server-core/errors";
import { GetRouteKey } from "@noctf/server-core/util/limit_keys";
import { Policy } from "@noctf/server-core/util/policy";
import { route } from "@noctf/server-core/util/route";
import { IsTimeBetweenSeconds } from "@noctf/server-core/util/time";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { GetUtils } from "./_util.ts";

export async function routes(fastify: FastifyInstance) {
  const {
    challengeService,
    scoreboardService,
    configService,
    divisionService,
  } = fastify.container.cradle;

  const { gateStartTime } = GetUtils(fastify.container.cradle);
  const adminPolicy: Policy = ["admin.challenge.get"];

  route(
    fastify,
    ListChallenges,
    {
      auth: {
        policy: ["OR", "challenge.get", "admin.challenge.get"],
      },
    },
    async (request) => {
      const ctime = Date.now();
      const admin = await gateStartTime(adminPolicy, ctime, request.user?.id);

      const challengesPromise = challengeService.list(
        admin ? {} : { hidden: false, visible_at: new Date(ctime + 60000) },
        {
          cacheKey: `route:/challenges:${admin}`,
          removePrivateTags: true,
        },
      );
      const [challenges, team] = await Promise.all([
        challengesPromise,
        request.user?.membership,
      ]);

      const scoreObj = await scoreboardService.getChallengesSummary(
        team?.division_id || 1, // TODO: configurable default
      );
      const solves = new Set<number>();

      // Does not need to rely on scoreboard calcs
      if (team) {
        const entry = await scoreboardService.getTeam(
          team.division_id,
          team.team_id,
        );
        if (entry) {
          entry.solves.forEach(({ challenge_id }) => solves.add(challenge_id));
        }
      }
      const values = Object.fromEntries(
        challenges.map((c) => [
          c.id,
          {
            value: scoreObj[c.id]?.value || 0,
            solve_count: scoreObj[c.id]?.solve_count || 0,
            solved_by_me: solves.has(c.id),
          },
        ]),
      );

      const visible = new Set(
        challenges
          .filter(
            ({ visible_at }) =>
              admin || (visible_at ? ctime > visible_at.getTime() : true),
          )
          .map(({ id }) => id),
      );
      return {
        data: {
          challenges: challenges
            .filter(({ id }) => visible.has(id))
            .map((c) => ({
              ...c,
              ...values[c.id],
              hidden: c.hidden || c.visible_at?.getTime() > ctime,
            })),
        },
      };
    },
  );

  route(
    fastify,
    GetChallenge,
    {
      auth: {
        policy: ["OR", "challenge.get", "admin.challenge.get"],
      },
    },
    async (request, reply) => {
      const ctime = Date.now();
      const admin = await gateStartTime(adminPolicy, ctime, request.user?.id);
      const { id } = request.params;

      // Cannot cache directly as could be rendered with team_id as param
      const challenge = await challengeService.getRendered(id);
      if (
        !admin &&
        (challenge.hidden ||
          (challenge.visible_at !== null &&
            ctime < challenge.visible_at.getTime()))
      ) {
        throw new NotFoundError("Challenge not found");
      }
      reply.header("cache-control", "private, max-age=60");
      return {
        data: challenge,
      };
    },
  );

  route(
    fastify,
    GetChallengeSolves,
    {
      auth: {
        policy: ["OR", "scoreboard.get", "admin.challenge.get"],
      },
    },
    async (request) => {
      const ctime = Date.now();
      const admin = await gateStartTime(adminPolicy, ctime, request.user?.id);
      const { id } = request.params;

      // Cannot cache directly as could be rendered with team_id as param
      const challenge = await challengeService.get(id, true);
      if (
        !admin &&
        (challenge.hidden ||
          (challenge.visible_at !== null &&
            ctime < challenge.visible_at.getTime()))
      ) {
        throw new NotFoundError("Challenge not found");
      }
      const membership = await request.user?.membership;
      let divisionId = request.query.division_id;
      if (!divisionId) {
        divisionId = membership?.division_id;
      }
      if (!divisionId) {
        divisionId =
          (await configService.get(SetupConfig)).value.default_division_id || 1;
      }
      if (divisionId !== membership?.division_id && !admin) {
        const division = await divisionService.get(divisionId);
        if (!division?.is_visible)
          throw new NotFoundError("Division not found");
      }

      return {
        data: (
          await scoreboardService.getChallengeSolves(divisionId, id)
        ).filter(({ hidden }) => !hidden),
      };
    },
  );

  route(
    fastify,
    SolveChallenge,
    {
      auth: {
        require: true,
        policy: ["OR", "challenge.solves.create"],
      },
      rateLimit: async (r: FastifyRequest<{ Params: IdParams }>) => [
        {
          key: `${GetRouteKey(r)}:t${(await r.user?.membership)?.team_id || 0}`,
          limit: 8,
          windowSeconds: 60,
        },
        {
          key: `${GetRouteKey(r)}:t${(await r.user?.membership)?.team_id || 0}i${r.params.id}`,
          limit: 2,
          windowSeconds: 30,
        },
      ],
    },
    async (request) => {
      const ctime = Date.now();
      const admin = await gateStartTime(adminPolicy, ctime, request.user?.id);
      const { id } = request.params;

      const { value: config } = await configService.get(SetupConfig);
      const end = config.end_time_s;
      if (
        !config.allow_late_submissions &&
        (end || end === 0) &&
        ctime > end * 1000
      ) {
        throw new ForbiddenError("The CTF has ended. Thanks for playing!");
      }

      // Cannot cache directly as could be rendered with team_id as param
      const challenge = await challengeService.get(id, true);
      if (
        !admin &&
        (challenge.hidden ||
          (challenge.visible_at !== null &&
            ctime < challenge.visible_at.getTime()))
      ) {
        throw new NotFoundError("Challenge not found");
      }
      const membership = await request.user?.membership;

      if (!membership) {
        throw new ForbiddenError("You are not currently part of a team");
      }

      const { status, created_at } = await challengeService.solve(
        challenge,
        membership.team_id,
        request.user.id,
        request.body.data,
        { ip: request.ip },
      );

      return {
        data: {
          status,
          hidden: !IsTimeBetweenSeconds(
            created_at,
            config.start_time_s,
            config.end_time_s,
          ),
        },
      };
    },
  );
}
