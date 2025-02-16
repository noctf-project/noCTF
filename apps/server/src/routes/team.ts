import type { ServiceCradle } from "@noctf/server-core";
import type { FastifyInstance } from "fastify";
import "@noctf/server-core/types/fastify";
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  NotImplementedError,
} from "@noctf/server-core/errors";
import {
  CreateTeamRequest,
  JoinTeamRequest,
  UpdateTeamRequest,
} from "@noctf/api/requests";
import {
  GetTeamResponse,
  ListTeamsResponse,
  MeTeamResponse,
  SuccessResponse,
} from "@noctf/api/responses";
import { ActorType } from "@noctf/server-core/types/enums";
import { GetTeamParams } from "@noctf/api/params";

const CACHE_NAMESPACE = "route:challenge";

export async function routes(fastify: FastifyInstance) {
  const { teamService, cacheService } = fastify.container
    .cradle as ServiceCradle;

  fastify.post<{ Body: CreateTeamRequest; Reply: MeTeamResponse }>(
    "/teams",
    {
      schema: {
        security: [{ bearer: [] }],
        tags: ["team"],
        auth: {
          require: true,
          policy: ["team.create"],
        },
        body: CreateTeamRequest,
        response: {
          201: MeTeamResponse,
        },
      },
    },
    async (request, reply) => {
      if (await teamService.getMembershipForUser(request.user.id)) {
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
          policy: ["team.self.join"],
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
          policy: ["team.self.leave"],
        },
      },
    },
    async () => {
      throw new NotImplementedError();
    },
  );

  fastify.get<{ Reply: MeTeamResponse }>(
    "/team",
    {
      schema: {
        security: [{ bearer: [] }],
        tags: ["team"],
        auth: {
          require: true,
          policy: ["team.self"],
        },
        response: {
          200: MeTeamResponse,
        },
      },
    },
    async (request) => {
      const membership = await teamService.getMembershipForUser(
        request.user.id,
      );
      if (!membership) {
        throw new NotFoundError("You are not currently part of a team");
      }
      return {
        data: await teamService.get(membership.team_id),
      };
    },
  );

  fastify.put<{ Body: UpdateTeamRequest; Reply: SuccessResponse }>(
    "/team",
    {
      schema: {
        security: [{ bearer: [] }],
        tags: ["team"],
        auth: {
          require: true,
          policy: ["team.self.update"],
        },
        body: UpdateTeamRequest,
        response: {
          200: SuccessResponse,
        },
      },
    },
    async (request) => {
      const membership = await teamService.getMembershipForUser(
        request.user.id,
      );
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

  fastify.get<{ Reply: ListTeamsResponse }>(
    "/teams",
    {
      schema: {
        security: [{ bearer: [] }],
        tags: ["team"],
        response: {
          200: ListTeamsResponse,
        },
        auth: {
          require: true,
          policy: ["OR", "team.get"],
        },
      },
    },
    async (_request, reply) => {
      const teams = await cacheService.load(CACHE_NAMESPACE, "list", () =>
        teamService.list(["!hidden"]),
      );

      reply.header("cache-control", "private, max-age=900");
      return {
        data: teams,
      };
    },
  );

  fastify.get<{ Params: GetTeamParams; Reply: GetTeamResponse }>(
    "/teams/:id",
    {
      schema: {
        security: [{ bearer: [] }],
        tags: ["team"],
        params: GetTeamParams,
        response: {
          200: GetTeamResponse,
        },
        auth: {
          require: true,
          policy: ["OR", "team.get"],
        },
      },
    },
    async (request, reply) => {
      const team = await teamService.get(request.params.id);
      if (!team || team.flags.includes("hidden")) {
        throw new NotFoundError("Team not found");
      }

      reply.header("cache-control", "private, max-age=900");
      return {
        data: team,
      };
    },
  );

  fastify.get<{ Params: GetTeamParams; Reply: GetTeamResponse }>(
    "/teams/:id/solves",
    {
      schema: {
        security: [{ bearer: [] }],
        tags: ["team"],
        params: GetTeamParams,
        response: {
          200: GetTeamResponse,
        },
        auth: {
          require: true,
          policy: ["OR", "team.get"],
        },
      },
    },
    async () => {
      // TODO: get all solves for a team + score graph
      // TODO: for admin: score-graph won't show hidden
      throw new NotImplementedError();
    },
  );
}
