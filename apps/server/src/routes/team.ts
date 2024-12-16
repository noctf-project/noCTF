import { ServiceCradle } from "@noctf/server-core";
import { FastifyInstance } from "fastify";
import { TeamConfig } from "@noctf/api/config";
import "@noctf/server-core/types/fastify";
import { ConflictError, NotFoundError } from "@noctf/server-core/errors";
import { CreateTeamRequest } from "@noctf/api/requests";
import { MeTeamResponse } from "@noctf/api/responses";

export async function routes(fastify: FastifyInstance) {
  const { configService, teamService } = fastify.container
    .cradle as ServiceCradle;
  await configService.register<TeamConfig>(TeamConfig, {
    max_members: 0,
  });

  fastify.post<{ Body: CreateTeamRequest; Reply: MeTeamResponse }>(
    "/team",
    {
      schema: {
        security: [{ bearer: [] }],
        tags: ["team"],
        auth: {
          require: true,
          policy: ["OR", "team.create"],
        },
        body: CreateTeamRequest,
        response: {
          "2xx": MeTeamResponse,
        },
      },
    },
    async (request) => {
      if (await teamService.getMembership(request.user.id)) {
        throw new ConflictError("You are currently part of a team");
      }
      const team = await teamService.create({
        name: request.body.name,
        generate_join_code: true,
      });
      await teamService.assignMember({
        team_id: team.id,
        user_id: request.user.id,
      });
      return {
        data: team,
      };
    },
  );

  fastify.post(
    "/team/join",
    {
      schema: {
        tags: ["team"],
        security: [{ bearer: [] }],
        auth: {
          require: true,
          policy: ["OR", "team.join"],
        },
      },
    },
    async () => {
      return "good";
    },
  );

  fastify.get<{ Reply: MeTeamResponse }>(
    "/team/me",
    {
      schema: {
        security: [{ bearer: [] }],
        tags: ["team"],
        auth: {
          require: true,
          policy: ["OR", "team.view", "team.me"],
        },
        response: {
          200: MeTeamResponse,
        },
      },
    },
    async (request) => {
      const membership = await teamService.getMembership(request.user.id);
      if (!membership) {
        throw new NotFoundError("You are not currently part of a team");
      }
      return {
        data: await teamService.get(membership.id),
      };
    },
  );

  fastify.post(
    "/team/me",
    {
      schema: {
        security: [{ bearer: [] }],
        tags: ["team"],
        auth: {
          require: true,
          policy: ["OR", "team.me:w"],
        },
        response: {
          200: MeTeamResponse,
        },
      },
    },
    async () => {
      return "good";
    },
  );

  fastify.delete(
    "/team/me",
    {
      schema: {
        security: [{ bearer: [] }],
        tags: ["team"],
        auth: {
          require: true,
          policy: ["OR", "team.leave"],
        },
      },
    },
    async () => {
      return "good";
    },
  );

  fastify.get(
    "/team/id/:id",
    {
      schema: {
        security: [{ bearer: [] }],
        tags: ["team"],
        auth: {
          require: true,
          policy: ["OR", "team.view"],
        },
      },
    },
    async () => {
      return "good";
    },
  );
}
