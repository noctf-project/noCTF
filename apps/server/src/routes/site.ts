import { SetupConfig } from "@noctf/api/config";
import { Route } from "@noctf/api/contract/util";
import { GetAnnouncements } from "@noctf/api/contract/site";
import {
  GetAnnouncementsResponse,
  GetSiteConfigResponse,
} from "@noctf/api/responses";
import { ServiceCradle } from "@noctf/server-core";
import { AnnouncementService } from "@noctf/server-core/services/announcement";
import { GetRouteUserIPKey } from "@noctf/server-core/util/limit_keys";
import { Type } from "@sinclair/typebox";
import { FastifyInstance } from "fastify";
import { GetAnnouncementsQuery } from "@noctf/api/query";

export async function routes(fastify: FastifyInstance) {
  const { configService, announcementService, policyService } = fastify
    .container.cradle as ServiceCradle;

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
        response: {
          200: GetAnnouncementsResponse,
        },
        querystring: GetAnnouncementsQuery,
      },
      config: {
        auth: {
          policy: ["announcement.get"],
        },
        rateLimit: (r) => [
          {
            key: GetRouteUserIPKey(r),
            limit: r.user ? 30 : 90,
            windowSeconds: 60,
          },
        ],
      },
    },
    async (request) => {
      const visible_to: string[] = [];
      if (!request.routeOptions.config.auth?.require) {
        visible_to.push("public");
      }
      if (request.user) {
        visible_to.push(
          "user",
          `user:${request.user.id}`,
          ...[...(await policyService.getRolesForUser(request.user.id))].map(
            (r) => `role:${r}`,
          ),
        );
        const membership = await request.user.membership;
        if (membership) {
          visible_to.push("team", `team:${membership.team_id}`);
        }
      }
      return {
        data: {
          entries: (
            await announcementService.getVisible(
              visible_to,
              (request.query.updated_at &&
                new Date(request.query.updated_at)) ||
                undefined,
              100,
            )
          ).map((x) => ({
            ...x,
            is_private: AnnouncementService.isPrivate(x.visible_to),
          })),
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
