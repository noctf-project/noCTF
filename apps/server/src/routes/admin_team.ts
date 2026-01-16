import {
  AdminDeleteTeam,
  AdminQueryTeams,
  AdminUpdateTeam,
  AdminUpdateTeamMember,
} from "@noctf/api/contract/admin_team";
import { ActorType } from "@noctf/server-core/types/enums";
import { OffsetPaginate } from "@noctf/server-core/util/paginator";
import { route } from "@noctf/server-core/util/route";
import { FastifyInstance } from "fastify";

export const PAGE_SIZE = 60;

export async function routes(fastify: FastifyInstance) {
  const { teamService } = fastify.container.cradle;

  route(
    fastify,
    AdminQueryTeams,
    {
      auth: {
        require: true,
        policy: ["admin.team.get"],
      },
    },
    async (request) => {
      const { page, page_size, ...query } = request.body;
      const [result, total] = await Promise.all([
        OffsetPaginate(query, { page, page_size }, (q, l) =>
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

  route(
    fastify,
    AdminUpdateTeam,
    {
      auth: {
        require: true,
        policy: ["admin.team.update"],
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

  route(
    fastify,
    AdminDeleteTeam,
    {
      auth: {
        require: true,
        policy: ["admin.team.delete"],
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

  route(
    fastify,
    AdminUpdateTeamMember,
    {
      auth: {
        require: true,
        policy: ["admin.team.update"],
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
