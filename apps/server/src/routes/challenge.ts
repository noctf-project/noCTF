import { SetupConfig } from "@noctf/api/config";
import type { ChallengePrivateMetadataBase } from "@noctf/api/datatypes";
import { GetChallengeFileParams, GetChallengeParams } from "@noctf/api/params";
import {
  GetChallengeResponse,
  GetChallengeSolvesResponse,
  ListChallengesResponse,
  SolveChallengeResponse,
} from "@noctf/api/responses";
import { ForbiddenError, NotFoundError } from "@noctf/server-core/errors";
import { LocalCache } from "@noctf/server-core/util/local_cache";
import type { FastifyInstance } from "fastify";
import { ServeFileHandler } from "../hooks/file.ts";
import { SolveChallengeRequest } from "@noctf/api/requests";

const CACHE_NAMESPACE = "route:challenge";

export async function routes(fastify: FastifyInstance) {
  const {
    configService,
    policyService,
    cacheService,
    teamService,
    challengeService,
    scoreboardService,
  } = fastify.container.cradle;
  const adminCache = new LocalCache<number, boolean>({ ttl: 1000, max: 5000 });
  const gateAdmin = async (ctime: number, userId?: number) => {
    const admin = await adminCache.load(userId || 0, () =>
      policyService.evaluate(userId || 0, ["admin.challenge.get"]),
    );
    if (!admin) {
      const {
        value: { active, start_time_s },
      } = await configService.get<SetupConfig>(SetupConfig.$id);
      if (!active) {
        throw new ForbiddenError("The CTF is not currently active");
      }
      if (ctime < start_time_s * 1000) {
        throw new ForbiddenError("The CTF has not started yet");
      }
    }
    return admin;
  };

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
      const admin = await gateAdmin(ctime, request.user?.id);

      const challenges = await cacheService.load(
        CACHE_NAMESPACE,
        `list:${admin}`,
        async () => {
          return await challengeService.list(
            // To account for clock skew
            admin ? {} : { hidden: false, visible_at: new Date(ctime + 60000) },
            true,
          );
        },
      );

      const team = request.user?.id
        ? await teamService.getMembershipForUser(request.user?.id)
        : undefined;
      const { data: scoreObj } = await scoreboardService.getChallengeScores(1);
      const scores = Object.fromEntries(
        challenges.map((c) => [
          c.id,
          {
            score: scoreObj[c.id]?.score,
            solve_count:
              scoreObj[c.id]?.solves?.filter((x) => !x.hidden).length || 0,
            solved_by_me: !!scoreObj[c.id]?.solves?.find(
              ({ team_id }) => team_id == team?.team_id,
            ),
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

  fastify.get<{ Params: GetChallengeParams }>(
    "/challenges/:id",
    {
      schema: {
        tags: ["challenge"],
        security: [{ bearer: [] }],
        auth: {
          policy: ["OR", "challenge.get", "admin.challenge.get"],
        },
        params: GetChallengeParams,
        response: {
          200: GetChallengeResponse,
        },
      },
    },
    async (request) => {
      const ctime = Date.now();
      const admin = await gateAdmin(ctime, request.user?.id);
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
    Params: GetChallengeParams;
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
        params: GetChallengeParams,
        response: {
          200: GetChallengeSolvesResponse,
        },
      },
    },
    async (request) => {
      const ctime = Date.now();
      const admin = await gateAdmin(ctime, request.user?.id);
      const { id } = request.params;

      // Cannot cache directly as could be rendered with team_id as param
      const challenge = await challengeService.getMetadata(id);
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
      return {
        data: (await scoreboardService.getChallengeScores(1)).data[
          id
        ]?.solves?.filter(({ hidden }) => !hidden),
      };
    },
  );

  fastify.post<{
    Body: SolveChallengeRequest;
    Params: GetChallengeParams;
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
        params: GetChallengeParams,
        body: SolveChallengeRequest,
        response: {
          200: SolveChallengeResponse,
        },
      },
    },
    async (request) => {
      const ctime = Date.now();
      const admin = await gateAdmin(ctime, request.user?.id);
      const { id } = request.params;

      // Cannot cache directly as could be rendered with team_id as param
      const metadata = await challengeService.getMetadata(id);
      if (
        !admin &&
        (metadata.hidden ||
          (metadata.visible_at !== null &&
            ctime < metadata.visible_at.getTime()))
      ) {
        throw new NotFoundError("Challenge not found");
      }
      const team = await teamService.getMembershipForUser(request.user.id);
      if (!team) {
        throw new ForbiddenError("You are not currently part of a team");
      }

      return {
        data: await challengeService.solve(
          metadata,
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
      const admin = await gateAdmin(ctime, request.user?.id);
      const { id } = request.params;
      const challenge = await challengeService.getMetadata(id);
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
