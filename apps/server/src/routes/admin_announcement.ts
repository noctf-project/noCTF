import { IdParams } from "@noctf/api/params";
import {
  AdminCreateAnnouncementRequest,
  AdminQueryAnnouncementsRequest,
  AdminUpdateAnnouncementRequest,
} from "@noctf/api/requests";
import {
  AdminGetAnnouncementDeliveryChannelsResponse,
  AdminGetAnnouncementResponse,
  AdminListAnnnouncementsResponse,
  BaseResponse,
} from "@noctf/api/responses";
import { ActorType } from "@noctf/server-core/types/enums";
import { OffsetPaginate } from "@noctf/server-core/util/paginator";
import { FastifyInstance } from "fastify";

export async function routes(fastify: FastifyInstance) {
  const { announcementService } = fastify.container.cradle;

  fastify.get<{
    Reply: AdminListAnnnouncementsResponse;
    Body: AdminQueryAnnouncementsRequest;
  }>(
    "/admin/announcements/query",
    {
      schema: {
        security: [{ bearer: [] }],
        tags: ["admin"],
        response: {
          200: AdminListAnnnouncementsResponse,
        },
        auth: {
          require: true,
          policy: ["admin.announcement.get"],
        },
      },
    },
    async (request) => {
      const { page, page_size, ...query } = request.body;
      const [result, total] = await Promise.all([
        OffsetPaginate(query, { page, page_size }, (q, l) =>
          announcementService.list(q, l),
        ),
        announcementService.listCount(query),
      ]);
      return {
        data: {
          ...result,
          total: total || result.entries.length,
        },
      };
    },
  );

  fastify.get<{
    Reply: AdminGetAnnouncementDeliveryChannelsResponse;
  }>(
    "/admin/announcements/delivery_channels",
    {
      schema: {
        security: [{ bearer: [] }],
        tags: ["admin"],
        response: {
          200: AdminGetAnnouncementDeliveryChannelsResponse,
        },
        auth: {
          require: true,
          policy: [
            "OR",
            "admin.announcement.create",
            "admin.announcement.update",
          ],
        },
      },
    },
    async () => {
      return {
        data: await announcementService.getDeliveryChannels(),
      };
    },
  );

  fastify.post<{
    Reply: AdminGetAnnouncementResponse;
    Body: AdminCreateAnnouncementRequest;
  }>(
    "/admin/announcements",
    {
      schema: {
        security: [{ bearer: [] }],
        tags: ["admin"],
        response: {
          200: AdminGetAnnouncementResponse,
        },
        body: AdminCreateAnnouncementRequest,
        auth: {
          require: true,
          policy: ["admin.announcement.create"],
        },
      },
    },
    async (request) => {
      return {
        data: await announcementService.create(
          {
            ...request.body,
            updated_by: request.user.id,
            created_by: request.user.id,
          },
          {
            actor: {
              type: ActorType.USER,
              id: request.user.id,
            },
            message: "Announcement created",
          },
        ),
      };
    },
  );

  fastify.put<{
    Reply: AdminGetAnnouncementResponse;
    Body: AdminUpdateAnnouncementRequest;
    Params: IdParams;
  }>(
    "/admin/announcements/:id",
    {
      schema: {
        security: [{ bearer: [] }],
        tags: ["admin"],
        response: {
          200: AdminGetAnnouncementResponse,
        },
        params: IdParams,
        body: AdminUpdateAnnouncementRequest,
        auth: {
          require: true,
          policy: ["admin.announcement.update"],
        },
      },
    },
    async (request) => {
      const { updated_at, ...rest } = request.body;
      const data = await announcementService.update(
        request.params.id,
        updated_at ? new Date(updated_at) : undefined,
        {
          ...rest,
          updated_by: request.user.id,
        },
        {
          actor: {
            type: ActorType.USER,
            id: request.user.id,
          },
          message: "Announcement updated",
        },
      );
      return {
        data,
      };
    },
  );

  fastify.delete<{ Reply: BaseResponse; Params: IdParams }>(
    "/admin/announcements/:id",
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
          policy: ["admin.announcement.delete"],
        },
      },
    },
    async (request) => {
      await announcementService.delete(request.params.id, undefined, {
        actor: {
          type: ActorType.USER,
          id: request.user.id,
        },
        message: "Announcement deleted",
      });
      return {};
    },
  );
}
