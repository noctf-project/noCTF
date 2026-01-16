import {
  AdminCreateAnnouncement,
  AdminDeleteAnnouncement,
  AdminGetAnnouncementDeliveryChannels,
  AdminQueryAnnouncements,
  AdminUpdateAnnouncement,
} from "@noctf/api/contract/admin_announcement";
import { ActorType } from "@noctf/server-core/types/enums";
import { OffsetPaginate } from "@noctf/server-core/util/paginator";
import { route } from "@noctf/server-core/util/route";
import { FastifyInstance } from "fastify";

export async function routes(fastify: FastifyInstance) {
  const { announcementService } = fastify.container.cradle;

  route(
    fastify,
    AdminQueryAnnouncements,
    {
      auth: {
        require: true,
        policy: ["admin.announcement.get"],
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

  route(
    fastify,
    AdminGetAnnouncementDeliveryChannels,
    {
      auth: {
        require: true,
        policy: [
          "OR",
          "admin.announcement.create",
          "admin.announcement.update",
        ],
      },
    },
    async () => {
      return {
        data: await announcementService.getDeliveryChannels(),
      };
    },
  );

  route(
    fastify,
    AdminCreateAnnouncement,
    {
      auth: {
        require: true,
        policy: ["admin.announcement.create"],
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

  route(
    fastify,
    AdminUpdateAnnouncement,
    {
      auth: {
        require: true,
        policy: ["admin.announcement.update"],
      },
    },
    async (request) => {
      const { version, ...rest } = request.body;
      const data = await announcementService.update(
        request.params.id,
        version,
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

  route(
    fastify,
    AdminDeleteAnnouncement,
    {
      auth: {
        require: true,
        policy: ["admin.announcement.delete"],
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
