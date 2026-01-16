import { IdParams } from "@noctf/api/params";
import {
  AdminCreateAppRequest,
  AdminUpdateAppRequest,
} from "@noctf/api/requests";
import {
  AdminListAppResponse,
  AdminAppResponse,
  AdminAppWithSecretResponse,
  BaseResponse,
} from "@noctf/api/responses";
import { ActorType } from "@noctf/server-core/types/enums";
import { FastifyInstance } from "fastify";
import { Type } from "@sinclair/typebox";

export async function routes(fastify: FastifyInstance) {
  const { appService } = fastify.container.cradle;

  fastify.get<{ Reply: AdminListAppResponse }>(
    "/admin/apps",
    {
      schema: {
        security: [{ bearer: [] }],
        tags: ["admin"],
        response: {
          200: AdminListAppResponse,
        },
      },
      config: {
        auth: {
          require: true,
          policy: ["admin.app.get"],
        },
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

  fastify.post<{
    Reply: AdminAppWithSecretResponse;
    Body: AdminCreateAppRequest;
  }>(
    "/admin/apps",
    {
      schema: {
        security: [{ bearer: [] }],
        tags: ["admin"],
        response: {
          200: AdminAppWithSecretResponse,
        },
        body: AdminCreateAppRequest,
      },
      config: {
        auth: {
          require: true,
          policy: ["admin.app.manage"],
        },
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

  fastify.put<{
    Reply: AdminAppResponse | AdminAppWithSecretResponse;
    Body: AdminUpdateAppRequest;
    Params: IdParams;
  }>(
    "/admin/apps/:id",
    {
      schema: {
        security: [{ bearer: [] }],
        tags: ["admin"],
        response: {
          200: Type.Union([AdminAppResponse, AdminAppWithSecretResponse]),
        },
        params: IdParams,
        body: AdminUpdateAppRequest,
      },
      config: {
        auth: {
          require: true,
          policy: ["admin.app.manage"],
        },
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

  fastify.delete<{ Reply: BaseResponse; Params: IdParams }>(
    "/admin/apps/:id",
    {
      schema: {
        security: [{ bearer: [] }],
        tags: ["admin"],
        response: {
          200: BaseResponse,
        },
        params: IdParams,
      },
      config: {
        auth: {
          require: true,
          policy: ["admin.app.manage"],
        },
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
