import { IdParams } from "@noctf/api/params";
import {
  AdminQueryTeamsRequest,
  AdminUpdateTeamMemberRequest,
  AdminUpdateTeamRequest,
} from "@noctf/api/requests";
import {
  AdminListTeamsResponse,
  BaseResponse,
  UpdateTeamResponse,
} from "@noctf/api/responses";
import { ActorType } from "@noctf/server-core/types/enums";
import { Paginate } from "@noctf/server-core/util/paginator";
import { FastifyInstance } from "fastify";

export const PAGE_SIZE = 60;

export async function routes(fastify: FastifyInstance) {
  const { teamService } = fastify.container.cradle;

  fastify.post<{ Reply: AdminListTeamsResponse; Body: AdminQueryTeamsRequest }>(
    "/admin/teams/query",
    {
      schema: {
        security: [{ bearer: [] }],
        tags: ["admin"],
        response: {
          200: AdminListTeamsResponse,
        },
        body: AdminQueryTeamsRequest,
        auth: {
          require: true,
          policy: ["admin.team.get"],
        },
      },
    },
    async (request) => {
      const { page, page_size, ...query } = request.body;
      const [result, total] = await Promise.all([
        Paginate(query, { page, page_size }, (q, l) =>
          teamService.listSummary(q, l),
        ),
        query.ids && query.ids.length ? 0 : teamService.getCount(query),
      ]);
      return {
        data: {
          ...result,
          total: total || result.entries.length,
        },
      };
    },
  );

  fastify.put<{
    Reply: UpdateTeamResponse;
    Body: AdminUpdateTeamRequest;
    Params: IdParams;
  }>(
    "/admin/teams/:id",
    {
      schema: {
        security: [{ bearer: [] }],
        tags: ["admin"],
        response: {
          200: UpdateTeamResponse,
        },
        body: AdminUpdateTeamRequest,
        params: IdParams,
        auth: {
          require: true,
          policy: ["admin.team.update"],
        },
      },
    },
    async (request) => {
      const { join_code } = await teamService.update(
        request.params.id,
        request.body,
        {
          actor: {
            type: ActorType.USER,
            id: request.user.id,
          },
        },
      );
      return {
        data: {
          join_code,
        },
      };
    },
  );

  fastify.delete<{
    Reply: BaseResponse;
    Params: IdParams;
  }>(
    "/admin/teams/:id",
    {
      schema: {
        security: [{ bearer: [] }],
        tags: ["admin"],
        response: {
          200: BaseResponse,
        },
        params: IdParams,
        auth: {
          require: true,
          policy: ["admin.team.delete"],
        },
      },
    },
    async (request) => {
      await teamService.delete(request.params.id, {
        actor: {
          type: ActorType.USER,
          id: request.user.id,
        },
        message: "Team deleted by admin",
      });
      return {};
    },
  );

  fastify.put<{
    Body: AdminUpdateTeamMemberRequest;
    Reply: BaseResponse;
    Params: IdParams;
  }>(
    "/admin/teams/:id/members",
    {
      schema: {
        security: [{ bearer: [] }],
        tags: ["admin"],
        response: {
          200: BaseResponse,
        },
        params: IdParams,
        body: AdminUpdateTeamMemberRequest,
        auth: {
          require: true,
          policy: ["admin.team.update"],
        },
      },
    },
    async (request) => {
      const role = request.body.role;
      switch (role) {
        case "none":
          await teamService.unassignMember(
            {
              team_id: request.params.id,
              user_id: request.body.user_id,
            },
            {
              actor: {
                type: ActorType.USER,
                id: request.user.id,
              },
              message: "Member removed by admin",
            },
          );
          break;
        case "member":
        case "owner":
          await teamService.assignMember(
            {
              team_id: request.params.id,
              user_id: request.body.user_id,
              role,
            },
            {
              actor: {
                type: ActorType.USER,
                id: request.user.id,
              },
              message: `Member assigned role ${role} by admin`,
            },
          );
      }

      return {};
    },
  );
}
