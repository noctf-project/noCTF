import { IdParams } from "@noctf/api/params";
import {
  AdminCreateAppRequest,
  AdminUpdateAppRequest,
} from "@noctf/api/requests";
import {
  AdminListAppResponse,
  AdminAppResponse,
  BaseResponse,
} from "@noctf/api/responses";
import { ActorType } from "@noctf/server-core/types/enums";
import { FastifyInstance } from "fastify";

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
    Reply: AdminAppResponse;
    Body: AdminCreateAppRequest;
  }>(
    "/admin/apps",
    {
      schema: {
        security: [{ bearer: [] }],
        tags: ["admin"],
        response: {
          200: AdminAppResponse,
        },
        body: AdminCreateAppRequest,
        auth: {
          require: true,
          policy: ["admin.app.manage"],
        },
      },
    },
    async (request) => {
      const app = await appService.create(request.body, {
        actor: {
          type: ActorType.USER,
          id: request.user.id,
        },
        message: "App created",
      });

      return {
        data: {
          ...app,
          client_secret: "***",
        },
      };
    },
  );

  fastify.put<{
    Reply: AdminAppResponse;
    Body: AdminUpdateAppRequest;
    Params: IdParams;
  }>(
    "/admin/apps/:id",
    {
      schema: {
        security: [{ bearer: [] }],
        tags: ["admin"],
        response: {
          200: AdminAppResponse,
        },
        params: IdParams,
        body: AdminUpdateAppRequest,
        auth: {
          require: true,
          policy: ["admin.app.manage"],
        },
      },
    },
    async (request) => {
      const app = await appService.update(request.params.id, request.body, {
        actor: {
          type: ActorType.USER,
          id: request.user.id,
        },
        message: "App updated",
      });

      return {
        data: {
          ...app,
          client_secret: "***",
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
