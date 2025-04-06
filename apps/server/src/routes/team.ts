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
  ListDivisionsResponse,
  ListTeamsResponse,
  MeTeamResponse,
  SuccessResponse,
} from "@noctf/api/responses";
import { ActorType } from "@noctf/server-core/types/enums";
import { IdParams } from "@noctf/api/params";
import { ListTeamsQuery } from "@noctf/api/query";

export async function routes(fastify: FastifyInstance) {
  const { teamService, policyService } = fastify.container
    .cradle as ServiceCradle;

  fastify.get<{ Reply: ListDivisionsResponse }>(
    "/divisions",
    {
      schema: {
        security: [{ bearer: [] }],
        tags: ["division"],
        auth: {
          policy: ["OR", "team.self.get", "division.get", "scoreboard.get"],
        },
        response: {
          200: ListDivisionsResponse,
        },
      },
    },
    async (request) => {
      const canList = policyService.evaluate(request.user?.id, [
        "division.get",
      ]);
      if (!canList && !request.user) {
        return { data: [] };
      }
      const membership = request.user
        ? await teamService.getMembershipForUser(request.user.id)
        : null;
      if (!canList) {
        if (!membership) return { data: [] };
        const division = await teamService.getDivision(membership.division_id);
        if (!division) return { data: [] };
        return { data: [{ ...division, is_password: !!division.password }] };
      }
      return {
        data: (
          await teamService.listDivisions({
            visible_ids: membership ? [membership.division_id] : [],
            is_visible: true,
          })
        ).map((x) => ({ ...x, is_password: !!x.password })),
      };
    },
  );

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
          division_id: request.body.division_id,
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
          policy: ["team.self.get"],
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

  fastify.get<{ Querystring: ListTeamsQuery; Reply: ListTeamsResponse }>(
    "/teams",
    {
      schema: {
        security: [{ bearer: [] }],
        tags: ["team"],
        response: {
          200: ListTeamsResponse,
        },
        querystring: ListTeamsQuery,
        auth: {
          require: true,
          policy: ["OR", "team.get"],
        },
      },
    },
    async (request, reply) => {
      const teams = await teamService.list(
        {
          flags: ["!hidden"],
          division_id: request.query.division_id,
        },
        true,
      );

      reply.header("cache-control", "private, max-age=600");
      return {
        data: teams,
      };
    },
  );

  fastify.get<{ Params: IdParams; Reply: GetTeamResponse }>(
    "/teams/:id",
    {
      schema: {
        security: [{ bearer: [] }],
        tags: ["team"],
        params: IdParams,
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
}
