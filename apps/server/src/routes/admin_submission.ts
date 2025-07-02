import {
  AdminQuerySubmissionsRequest,
  AdminUpdateSubmissionsRequest,
} from "@noctf/api/requests";
import {
  AdminQuerySubmissionsResponse,
  AdminUpdateSubmissionsResponse,
} from "@noctf/api/responses";
import type { FastifyInstance } from "fastify";
import "@noctf/server-core/types/fastify";
import type { Policy } from "@noctf/server-core/util/policy";
import { ActorType } from "@noctf/server-core/types/enums";

export const PAGE_SIZE = 60;

export async function routes(fastify: FastifyInstance) {
  const { submissionService } = fastify.container.cradle;

  const auth = {
    require: true,
    scopes: new Set(["admin"]),
  };

  fastify.post<{
    Body: AdminQuerySubmissionsRequest;
    Reply: AdminQuerySubmissionsResponse;
  }>(
    "/admin/submissions/query",
    {
      schema: {
        tags: ["admin"],
        security: [{ bearer: [] }],
        auth: {
          ...auth,
          policy: ["admin.submission.get"] as Policy,
        },
        body: AdminQuerySubmissionsRequest,
        response: {
          200: AdminQuerySubmissionsResponse,
        },
      },
    },
    async (request) => {
      const page = request.body.page || 1;
      const page_size = request.body.page_size ?? PAGE_SIZE;
      const { entries, total } = await submissionService.query(request.body, {
        limit: page_size,
        offset: (page - 1) * page_size,
      });

      return {
        data: { entries, page_size, total },
      };
    },
  );

  fastify.put<{
    Body: AdminUpdateSubmissionsRequest;
    Reply: AdminUpdateSubmissionsResponse;
  }>(
    "/admin/submissions",
    {
      schema: {
        tags: ["admin"],
        security: [{ bearer: [] }],
        auth: {
          ...auth,
          policy: ["admin.submission.update"] as Policy,
        },
        body: AdminUpdateSubmissionsRequest,
        response: {
          200: AdminUpdateSubmissionsResponse,
        },
      },
    },
    async (request) => ({
      data: await submissionService.update(request.body, {
        actor: {
          type: ActorType.USER,
          id: request.user?.id,
        },
        message: "Updated by admin",
      }),
    }),
  );
}
