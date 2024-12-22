import { SetupConfig } from "@noctf/api/config";
import { ForbiddenError } from "@noctf/server-core/errors";
import { FastifyInstance } from "fastify";

const CACHE_NAMESPACE = "route:challenge";

export async function routes(fastify: FastifyInstance) {
  const { configService, policyService, cacheService, challengeService } =
    fastify.container.cradle;

  fastify.get(
    "/challenges",
    {
      schema: {
        tags: ["challenge"],
        security: [{ bearer: [] }],
        auth: {
          policy: ["OR", "challenge.get", "admin.challenge.get"],
        },
      },
    },
    async (request) => {
      const admin = await policyService.evaluate(request.user?.id, [
        "admin.challenge.get",
      ]);

      if (!admin) {
        const {
          value: { active, start_time },
        } = await configService.get<SetupConfig>(SetupConfig.$id);
        if (!active) {
          throw new ForbiddenError("The CTF is not currently active");
        }
        if (new Date().getTime() < start_time) {
          throw new ForbiddenError("The CTF has not started yet");
        }
      }

      const challenges = await cacheService.load(
        CACHE_NAMESPACE,
        `list:${admin}`,
        () =>
          challengeService.list(
            admin ? {} : { hidden: false, visible_at: new Date() },
            !admin,
          ),
        { expireSeconds: 5 },
      );
      return {
        data: challenges,
      };
    },
  );
}
