import { SetupConfig } from "@noctf/api/config";
import type { ChallengePrivateMetadataBase } from "@noctf/api/datatypes";
import { GetChallengeFileParams, IdParams } from "@noctf/api/params";
import {
  GetChallengeResponse,
  GetChallengeSolvesResponse,
  ListChallengesResponse,
  SolveChallengeResponse,
} from "@noctf/api/responses";
import { ForbiddenError, NotFoundError } from "@noctf/server-core/errors";
import type { FastifyInstance } from "fastify";
import { ServeFileHandler } from "../hooks/file.ts";
import { SolveChallengeRequest } from "@noctf/api/requests";
import { GetUtils } from "./_util.ts";
import { Policy } from "@noctf/server-core/util/policy";

export async function routes(fastify: FastifyInstance) {
  const { teamService, challengeService, scoreboardService } =
    fastify.container.cradle;

  const { gateStartTime } = GetUtils(fastify.container.cradle);
  const adminPolicy: Policy = ["admin.challenge.get"];

  fastify.get<{ Reply: ListChallengesResponse }>(
    "/challenges",
    {
      schema: {
        tags: ["challenge"],
        security: [{ bearer: [] }],
        auth: {
          policy: ["OR", "challenge.get", "admin.challenge.get"],
        },
        response: {
          200: ListChallengesResponse,
        },
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
      const teamPromise = request.user?.id
        ? teamService.getMembershipForUser(request.user?.id)
        : undefined;
      const [challenges, team] = await Promise.all([
        challengesPromise,
        teamPromise,
      ]);

      const { data: scoreObj } = await scoreboardService.getChallengesSummary(
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
      const scores = Object.fromEntries(
        challenges.map((c) => [
          c.id,
          {
            score: scoreObj[c.id]?.score || 0,
            solve_count: scoreObj[c.id]?.solve_count || 0,
            solved_by_me: solves.has(c.id),
          },
        ]),
      );

      const visible = new Set(
        challenges
          .filter(({ visible_at }) =>
            visible_at ? ctime > visible_at.getTime() : true,
          )
          .map(({ id }) => id),
      );
      return {
        data: {
          challenges: challenges
            .filter(({ id }) => visible.has(id))
            .map((c) => ({ ...c, ...scores[c.id] })),
        },
      };
    },
  );

  fastify.get<{ Params: IdParams }>(
    "/challenges/:id",
    {
      schema: {
        tags: ["challenge"],
        security: [{ bearer: [] }],
        auth: {
          policy: ["OR", "challenge.get", "admin.challenge.get"],
        },
        params: IdParams,
        response: {
          200: GetChallengeResponse,
        },
      },
    },
    async (request) => {
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
      // TODO: render public metadata, add type
      return {
        data: challenge,
      };
    },
  );

  fastify.get<{
    Params: IdParams;
    Reply: GetChallengeSolvesResponse;
  }>(
    "/challenges/:id/solves",
    {
      schema: {
        tags: ["challenge"],
        security: [{ bearer: [] }],
        auth: {
          policy: ["OR", "challenge.solves.get", "admin.challenge.get"],
        },
        params: IdParams,
        response: {
          200: GetChallengeSolvesResponse,
        },
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
      // TODO: fix up all division ids, currently everything
      // is requesting division ID=1
      const team = request.user?.id
        ? await teamService.getMembershipForUser(request.user?.id)
        : undefined;
      return {
        data: (
          await scoreboardService.getChallengeSolves(team?.division_id || 1, id)
        ).filter(({ hidden }) => !hidden),
      };
    },
  );

  fastify.post<{
    Body: SolveChallengeRequest;
    Params: IdParams;
    Reply: SolveChallengeResponse;
  }>(
    "/challenges/:id/solves",
    {
      schema: {
        tags: ["challenge"],
        security: [{ bearer: [] }],
        auth: {
          require: true,
          policy: ["OR", "challenge.solves.create"],
        },
        params: IdParams,
        body: SolveChallengeRequest,
        response: {
          200: SolveChallengeResponse,
        },
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
      const team = await teamService.getMembershipForUser(request.user.id);
      if (!team) {
        throw new ForbiddenError("You are not currently part of a team");
      }

      return {
        data: await challengeService.solve(
          challenge,
          team.team_id,
          request.user.id,
          request.body.data,
        ),
      };
    },
  );

  fastify.get<{ Params: GetChallengeFileParams }>(
    "/challenges/:id/files/:filename",
    {
      schema: {
        security: [{ bearer: [] }],
        tags: ["challenge"],
        auth: {
          policy: ["challenge.get"],
        },
        params: GetChallengeFileParams,
      },
    },
    async (request, reply) => {
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
      const ref = (challenge.private_metadata as ChallengePrivateMetadataBase)
        .files?.[request.params.filename]?.ref;
      if (!ref) {
        throw new NotFoundError("File not found");
      }
      return ServeFileHandler(ref, request, reply);
    },
  );
}
