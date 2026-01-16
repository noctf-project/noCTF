import { SetupConfig } from "@noctf/api/config";
import {
  GetAnnouncements,
  GetHealthz,
  GetSiteConfig,
} from "@noctf/api/contract/site";
import { ServiceCradle } from "@noctf/server-core";
import { AnnouncementService } from "@noctf/server-core/services/announcement";
import { GetRouteUserIPKey } from "@noctf/server-core/util/limit_keys";
import { FastifyInstance } from "fastify";
import { route } from "@noctf/server-core/util/route";

export async function routes(fastify: FastifyInstance) {
  const { configService, announcementService, policyService } = fastify
    .container.cradle as ServiceCradle;

  route(fastify, GetSiteConfig, {}, async () => {
    return {
      data: (await configService.get(SetupConfig)).value,
    };
  });

  route(
    fastify,
    GetAnnouncements,
    {
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

  route(fastify, GetHealthz, {}, async () => ({ status: "OK" as const }));
}
