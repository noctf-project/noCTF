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

      const ctime = Date.now();
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
        data: challenges.filter(({ visible_at }) => ctime > visible_at.getTime()),
      };
    },
  );
}
