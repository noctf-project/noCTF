import { IdParams } from "@noctf/api/params";
import {
  AdminCreateDivisionRequest,
  AdminCreateTeamTagRequest,
  AdminUpdateDivisionRequest,
  AdminUpdateTeamTagRequest,
} from "@noctf/api/requests";
import {
  AdminDivisionResponse,
  AdminListDivisionsResponse,
  AdminListTeamTagsResponse,
  AdminTeamTagResponse,
  BaseResponse,
} from "@noctf/api/responses";
import { ActorType } from "@noctf/server-core/types/enums";
import { FastifyInstance } from "fastify";

export const PAGE_SIZE = 60;

export async function routes(fastify: FastifyInstance) {
  const { teamService, divisionService } = fastify.container.cradle;

  fastify.get<{ Reply: AdminListTeamTagsResponse }>(
    "/admin/team_tags",
    {
      schema: {
        security: [{ bearer: [] }],
        tags: ["admin"],
        response: {
          200: AdminListTeamTagsResponse,
        },
        auth: {
          require: true,
          policy: ["admin.team_tag.get"],
        },
      },
    },
    async () => {
      return {
        data: {
          tags: await teamService.listTags(),
        },
      };
    },
  );

  fastify.post<{
    Reply: AdminTeamTagResponse;
    Body: AdminCreateTeamTagRequest;
  }>(
    "/admin/team_tags",
    {
      schema: {
        security: [{ bearer: [] }],
        tags: ["admin"],
        response: {
          200: AdminTeamTagResponse,
        },
        body: AdminCreateTeamTagRequest,
        auth: {
          require: true,
          policy: ["admin.team_tag.manage"],
        },
      },
    },
    async (request) => {
      return {
        data: await teamService.createTag(request.body, {
          actor: {
            type: ActorType.USER,
            id: request.user.id,
          },
          message: "Tag created",
        }),
      };
    },
  );

  fastify.put<{
    Reply: BaseResponse;
    Body: AdminUpdateTeamTagRequest;
    Params: IdParams;
  }>(
    "/admin/team_tags/:id",
    {
      schema: {
        security: [{ bearer: [] }],
        tags: ["admin"],
        response: {
          200: BaseResponse,
        },
        params: IdParams,
        body: AdminUpdateTeamTagRequest,
        auth: {
          require: true,
          policy: ["admin.team_tag.manage"],
        },
      },
    },
    async (request) => {
      await teamService.updateTag(request.params.id, request.body, {
        actor: {
          type: ActorType.USER,
          id: request.user.id,
        },
        message: "Tag updated",
      });
      return {};
    },
  );

  fastify.delete<{ Reply: BaseResponse; Params: IdParams }>(
    "/admin/team_tags/:id",
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
          policy: ["admin.division.manage"],
        },
      },
    },
    async (request) => {
      await teamService.deleteTag(request.params.id, {
        actor: {
          type: ActorType.USER,
          id: request.user.id,
        },
        message: "Tag deleted",
      });
      return {};
    },
  );

  fastify.get<{ Reply: AdminListDivisionsResponse }>(
    "/admin/divisions",
    {
      schema: {
        security: [{ bearer: [] }],
        tags: ["admin"],
        response: {
          200: AdminListDivisionsResponse,
        },
        auth: {
          require: true,
          policy: ["admin.division.get"],
        },
      },
    },
    async () => {
      return {
        data: await divisionService.list(),
      };
    },
  );

  fastify.post<{
    Reply: AdminDivisionResponse;
    Body: AdminCreateDivisionRequest;
  }>(
    "/admin/divisions",
    {
      schema: {
        security: [{ bearer: [] }],
        tags: ["admin"],
        response: {
          200: AdminDivisionResponse,
        },
        body: AdminCreateDivisionRequest,
        auth: {
          require: true,
          policy: ["admin.division.manage"],
        },
      },
    },
    async (request) => {
      return {
        data: await divisionService.create(request.body, {
          actor: {
            type: ActorType.USER,
            id: request.user.id,
          },
          message: "Division created",
        }),
      };
    },
  );

  fastify.put<{
    Reply: BaseResponse;
    Body: AdminUpdateDivisionRequest;
    Params: IdParams;
  }>(
    "/admin/divisions/:id",
    {
      schema: {
        security: [{ bearer: [] }],
        tags: ["admin"],
        response: {
          200: BaseResponse,
        },
        params: IdParams,
        body: AdminUpdateDivisionRequest,
        auth: {
          require: true,
          policy: ["admin.division.manage"],
        },
      },
    },
    async (request) => {
      await divisionService.update(request.params.id, request.body, {
        actor: {
          type: ActorType.USER,
          id: request.user.id,
        },
        message: "Division updated",
      });
      return {};
    },
  );

  fastify.delete<{ Reply: BaseResponse; Params: IdParams }>(
    "/admin/divisions/:id",
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
          policy: ["admin.division.manage"],
        },
      },
    },
    async (request) => {
      await divisionService.delete(request.params.id, {
        actor: {
          type: ActorType.USER,
          id: request.user.id,
        },
        message: "Division deleted",
      });
      return {};
    },
  );
}
