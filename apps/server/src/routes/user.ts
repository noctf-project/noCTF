import type { ServiceCradle } from "@noctf/server-core";
import type { FastifyInstance } from "fastify";
import "@noctf/server-core/types/fastify";
import { MeUserResponse } from "@noctf/api/responses";

export async function routes(fastify: FastifyInstance) {
  const { userService, teamService } = fastify.container
    .cradle as ServiceCradle;

  fastify.get<{ Reply: MeUserResponse }>(
    "/user/me",
    {
      schema: {
        security: [{ bearer: [] }],
        tags: ["user"],
        auth: {
          require: true,
          policy: ["OR", "user.get", "user.self"],
        },
        response: {
          200: MeUserResponse,
        },
      },
    },
    async (request) => {
      const membership = await request.user?.membership;
      const teamDetails = membership?.team_id
        ? await teamService.get(membership?.team_id)
        : null;
      const user = await userService.get(request.user.id);
      return {
        data: {
          ...user,
          team_id: membership?.team_id || null,
          team_name: teamDetails?.name || null,
        },
      };
    },
  );
}
