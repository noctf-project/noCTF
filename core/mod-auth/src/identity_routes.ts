import { ListUserIdentitiesResponse } from "@noctf/api/responses";
import type { FastifyInstance } from "fastify";

export default async function (fastify: FastifyInstance) {
  const { identityService } = fastify.container.cradle;

  fastify.get<{
    Reply: ListUserIdentitiesResponse;
  }>(
    "/auth/identities",
    {
      schema: {
        security: [{ bearer: [] }],
        tags: ["auth"],
        auth: {
          require: true,
          policy: ["user.self.get"],
        },
        response: {
          200: ListUserIdentitiesResponse,
        },
      },
    },
    async (request) => {
      const identities = await identityService.listProvidersForUser(
        request.user.id,
      );
      return {
        data: identities,
      };
    },
  );
}
