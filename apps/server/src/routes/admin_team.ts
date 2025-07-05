import { IdParams } from "@noctf/api/params";
import {
  AdminQueryTeamsRequest,
  AdminUpdateTeamRequest,
} from "@noctf/api/requests";
import { AdminListTeamsResponse, BaseResponse } from "@noctf/api/responses";
import { ActorType } from "@noctf/server-core/types/enums";
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
      const page = request.body.page || 1;
      const page_size = request.body.page_size ?? PAGE_SIZE;

      const query = request.body;
      const [entries, total] = await Promise.all([
        teamService.listSummary(query, {
          limit: page_size,
          offset: (page - 1) * page_size,
        }),
        !(query.ids && query.ids.length) ? teamService.getCount(query) : 0,
      ]);

      return {
        data: {
          entries,
          page_size,
          total: total || entries.length,
        },
      };
    },
  );

  fastify.put<{
    Reply: BaseResponse;
    Body: AdminUpdateTeamRequest;
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
        body: AdminUpdateTeamRequest,
        params: IdParams,
        auth: {
          require: true,
          policy: ["admin.team.update"],
        },
      },
    },
    async (request) => {
      await teamService.update(request.params.id, request.body, {
        actor: {
          type: ActorType.USER,
          id: request.user.id,
        },
      });
      return {};
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
      });
      return {};
    },
  );
}
