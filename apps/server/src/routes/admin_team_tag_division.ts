import {
  AdminCreateDivision,
  AdminCreateTeamTag,
  AdminDeleteDivision,
  AdminDeleteTeamTag,
  AdminListDivisions,
  AdminListTeamTags,
  AdminUpdateDivision,
  AdminUpdateTeamTag,
} from "@noctf/api/contract/admin_team_tag_division";
import { ActorType } from "@noctf/server-core/types/enums";
import { route } from "@noctf/server-core/util/route";
import { FastifyInstance } from "fastify";

export const PAGE_SIZE = 60;

export async function routes(fastify: FastifyInstance) {
  const { teamService, divisionService } = fastify.container.cradle;

  route(
    fastify,
    AdminListTeamTags,
    {
      auth: {
        require: true,
        policy: ["admin.team_tag.get"],
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

  route(
    fastify,
    AdminCreateTeamTag,
    {
      auth: {
        require: true,
        policy: ["admin.team_tag.manage"],
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

  route(
    fastify,
    AdminUpdateTeamTag,
    {
      auth: {
        require: true,
        policy: ["admin.team_tag.manage"],
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

  route(
    fastify,
    AdminDeleteTeamTag,
    {
      auth: {
        require: true,
        policy: ["admin.division.manage"],
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

  route(
    fastify,
    AdminListDivisions,
    {
      auth: {
        require: true,
        policy: ["admin.division.get"],
      },
    },
    async () => {
      return {
        data: await divisionService.list(),
      };
    },
  );

  route(
    fastify,
    AdminCreateDivision,
    {
      auth: {
        require: true,
        policy: ["admin.division.manage"],
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

  route(
    fastify,
    AdminUpdateDivision,
    {
      auth: {
        require: true,
        policy: ["admin.division.manage"],
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

  route(
    fastify,
    AdminDeleteDivision,
    {
      auth: {
        require: true,
        policy: ["admin.division.manage"],
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
