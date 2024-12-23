import { SetupConfig } from "@noctf/api/config";
import { GetChallengeParams } from "@noctf/api/params";
import { ListChallengesResponse } from "@noctf/api/responses";
import { ForbiddenError, NotFoundError } from "@noctf/server-core/errors";
import type { FastifyInstance } from "fastify";

const CACHE_NAMESPACE = "route:challenge";

export async function routes(fastify: FastifyInstance) {
  const { configService, policyService, cacheService, challengeService } =
    fastify.container.cradle;

  const gateAdmin = async (ctime: number, userId?: number) => {
    const admin = await policyService.evaluate(userId, ["admin.challenge.get"]);

    if (!admin) {
      const {
        value: { active, start_time },
      } = await configService.get<SetupConfig>(SetupConfig.$id);
      if (!active) {
        throw new ForbiddenError("The CTF is not currently active");
      }
      if (ctime < start_time) {
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
        () =>
          challengeService.list(
            // To account for clock skew
            admin ? {} : { hidden: false, visible_at: new Date(ctime + 60000) },
            true,
          ),
      );
      return {
        data: challenges.filter(
          ({ visible_at }) => ctime > visible_at.getTime(),
        ),
      };
    },
  );

  fastify.get<{ Params: GetChallengeParams }>(
    "/challenges/:id_or_slug",
    {
      schema: {
        tags: ["challenge"],
        security: [{ bearer: [] }],
        auth: {
          policy: ["OR", "challenge.get", "admin.challenge.get"],
        },
        params: GetChallengeParams,
      },
    },
    async (request) => {
      const ctime = Date.now();
      const admin = await gateAdmin(ctime, request.user?.id);
      const { id_or_slug } = request.params;

      const challenge = await cacheService.load(
        CACHE_NAMESPACE,
        `get:${id_or_slug}`,
        () => challengeService.get(id_or_slug, true),
      );
      if (
        !admin &&
        (challenge.hidden ||
          (challenge.visible_at !== null &&
            ctime < challenge.visible_at.getTime()))
      ) {
        throw new NotFoundError("Challenge not found");
      }
      // TODO: render public metadata
      return {
        data: challenge,
      };
    },
  );
}
