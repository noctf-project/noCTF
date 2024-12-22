import type { ServiceCradle } from "@noctf/server-core";
import type { FastifyInstance } from "fastify";
import { TeamConfig } from "@noctf/api/config";
import "@noctf/server-core/types/fastify";
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from "@noctf/server-core/errors";
import {
  CreateTeamRequest,
  JoinTeamRequest,
  UpdateTeamRequest,
} from "@noctf/api/requests";
import { MeTeamResponse, SuccessResponse } from "@noctf/api/responses";
import { ActorType } from "@noctf/server-core/types/enums";

export async function routes(fastify: FastifyInstance) {
  const { teamService } = fastify.container.cradle as ServiceCradle;

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
          201: MeTeamResponse,
        },
      },
    },
    async (request, reply) => {
      if (await teamService.getMembership(request.user.id)) {
        throw new ConflictError("You are currently part of a team");
      }
      const actor = {
        type: ActorType.USER,
        id: request.user.id,
      };
      const team = await teamService.create(
        {
          name: request.body.name,
          generate_join_code: true,
        },
        {
          actor,
          message: "Created a team using self-service.",
        },
      );
      await teamService.assignMember(
        {
          team_id: team.id,
          user_id: request.user.id,
          role: "owner",
        },
        {
          actor: {
            type: ActorType.USER,
            id: request.user.id,
          },
          message: "Assigned owner permissions to the team's creator.",
        },
      );
      return reply.status(201).send({
        data: team,
      });
    },
  );

  fastify.post<{ Body: JoinTeamRequest; Reply: MeTeamResponse }>(
    "/team/join",
    {
      schema: {
        tags: ["team"],
        security: [{ bearer: [] }],
        auth: {
          require: true,
          policy: ["OR", "team.self.join"],
        },
        body: JoinTeamRequest,
        response: {
          201: MeTeamResponse,
        },
      },
    },
    async (request, reply) => {
      const id = await teamService.join(
        request.user.id,
        request.body.join_code,
      );

      return reply.status(201).send({
        data: await teamService.get(id),
      });
    },
  );

  fastify.delete(
    "/team/join",
    {
      schema: {
        security: [{ bearer: [] }],
        tags: ["team"],
        auth: {
          require: true,
          policy: ["OR", "team.self.leave"],
        },
      },
    },
    async () => {
      return "stub";
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
          policy: ["OR", "team.get", "team.self"],
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
        data: await teamService.get(membership.team_id),
      };
    },
  );

  fastify.put<{ Body: UpdateTeamRequest; Reply: SuccessResponse }>(
    "/team/me",
    {
      schema: {
        security: [{ bearer: [] }],
        tags: ["team"],
        auth: {
          require: true,
          policy: ["OR", "team.owner.update"],
        },
        body: UpdateTeamRequest,
        response: {
          200: SuccessResponse,
        },
      },
    },
    async (request) => {
      const membership = await teamService.getMembership(request.user.id);
      if (!membership) {
        throw new NotFoundError("You are not currently part of a team");
      }
      if (membership.role !== "owner") {
        throw new ForbiddenError("Only the team's owner can update the team");
      }
      await teamService.update(membership.team_id, request.body, {
        actor: {
          type: ActorType.USER,
          id: request.user.id,
        },
      });
      return {
        data: true,
      };
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
          policy: ["OR", "team.get"],
        },
      },
    },
    async () => {
      return "stub";
    },
  );
}
