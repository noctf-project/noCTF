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
import { OffsetPaginate } from "@noctf/server-core/util/paginator";

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
        body: AdminQuerySubmissionsRequest,
        response: {
          200: AdminQuerySubmissionsResponse,
        },
      },
      config: {
        auth: {
          ...auth,
          policy: ["admin.submission.get"] as Policy,
        },
      },
    },
    async (request) => {
      const { page, page_size, ...query } = request.body;
      const [result, total] = await Promise.all([
        OffsetPaginate(query, { page, page_size }, (q, l) =>
          submissionService.listSummary(q, l),
        ),
        submissionService.getCount(query),
      ]);
      return {
        data: {
          ...result,
          total,
        },
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
        body: AdminUpdateSubmissionsRequest,
        response: {
          200: AdminUpdateSubmissionsResponse,
        },
      },
      config: {
        auth: {
          ...auth,
          policy: ["admin.submission.update"] as Policy,
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
