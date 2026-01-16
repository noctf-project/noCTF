import {
  AdminCreateApp,
  AdminDeleteApp,
  AdminListApps,
  AdminUpdateApp,
} from "@noctf/api/contract/admin_app";
import { ActorType } from "@noctf/server-core/types/enums";
import { route } from "@noctf/server-core/util/route";
import { FastifyInstance } from "fastify";

export async function routes(fastify: FastifyInstance) {
  const { appService } = fastify.container.cradle;

  route(
    fastify,
    AdminListApps,
    {
      auth: {
        require: true,
        policy: ["admin.app.get"],
      },
    },
    async () => {
      const apps = await appService.list();
      return {
        data: apps.map((app) => ({
          ...app,
          client_secret: "***",
        })),
      };
    },
  );

  route(
    fastify,
    AdminCreateApp,
    {
      auth: {
        require: true,
        policy: ["admin.app.manage"],
      },
    },
    async (request) => {
      const { app, client_secret } = await appService.create(request.body, {
        actor: {
          type: ActorType.USER,
          id: request.user.id,
        },
        message: "App created",
      });

      return {
        data: {
          ...app,
          client_secret,
        },
      };
    },
  );

  route(
    fastify,
    AdminUpdateApp,
    {
      auth: {
        require: true,
        policy: ["admin.app.manage"],
      },
    },
    async (request) => {
      const { app, client_secret } = await appService.update(
        request.params.id,
        request.body,
        {
          actor: {
            type: ActorType.USER,
            id: request.user.id,
          },
          message:
            request.body.client_secret === "refresh"
              ? "App client secret refreshed"
              : "App updated",
        },
      );

      return {
        data: {
          ...app,
          client_secret: client_secret || "***",
        },
      };
    },
  );

  route(
    fastify,
    AdminDeleteApp,
    {
      auth: {
        require: true,
        policy: ["admin.app.manage"],
      },
    },
    async (request) => {
      await appService.delete(request.params.id, {
        actor: {
          type: ActorType.USER,
          id: request.user.id,
        },
        message: "App deleted",
      });
      return {};
    },
  );
}
