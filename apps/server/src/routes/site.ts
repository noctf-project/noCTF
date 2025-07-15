import { SetupConfig } from "@noctf/api/config";
import { GetAnnouncementsQuery } from "@noctf/api/query";
import {
  GetAnnouncementsResponse,
  GetSiteConfigResponse,
} from "@noctf/api/responses";
import { ServiceCradle } from "@noctf/server-core";
import { GetRouteUserIPKey } from "@noctf/server-core/util/limit_keys";
import { Type } from "@sinclair/typebox";
import { FastifyInstance } from "fastify";
import { request } from "http";

export async function routes(fastify: FastifyInstance) {
  const { configService, notificationService } = fastify.container
    .cradle as ServiceCradle;

  fastify.get<{ Reply: GetSiteConfigResponse }>(
    "/site/config",
    {
      schema: {
        tags: ["site"],
        security: [{ bearer: [] }],
        response: {
          200: GetSiteConfigResponse,
        },
      },
    },
    async () => {
      return {
        data: (await configService.get(SetupConfig)).value,
      };
    },
  );

  fastify.get<{
    Reply: GetAnnouncementsResponse;
    Querystring: GetAnnouncementsQuery;
  }>(
    "/announcements",
    {
      schema: {
        tags: ["site"],
        security: [{ bearer: [] }],
        auth: {
          policy: ["announcement.get"],
        },
        response: {
          200: GetAnnouncementsResponse,
        },
        rateLimit: (r) => [
          {
            key: GetRouteUserIPKey(r),
            limit: r.user ? 30 : 90,
            windowSeconds: 60,
          },
        ],
        querystring: GetAnnouncementsQuery,
      },
    },
    async (request) => {
      const visible_to: string[] = [];
      if (!request.routeOptions.schema?.auth?.require) {
        visible_to.push("anonymous");
      }
      if (request.user) {
        visible_to.push("user", `user:${request.user.id}`);
        const membership = await request.user.membership;
        if (membership) {
          visible_to.push("team", `team:${membership.team_id}`);
        }
      }
      return {
        data: {
          entries: await notificationService.getVisibleAnnouncements(
            visible_to,
            (request.query.updated_at && new Date(request.query.updated_at)) ||
              undefined,
            100,
          ),
          page_size: 100,
        },
      };
    },
  );

  fastify.get<{ Reply: { status: "OK" } }>(
    "/healthz",
    {
      schema: {
        tags: ["site"],
        security: [{ bearer: [] }],
        response: {
          200: Type.Object({ status: Type.Literal("OK") }),
        },
      },
    },
    async () => {
      return { status: "OK" };
    },
  );
}
