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
      const query = {
        created_at: request.body.created_at,
        user_id: request.body.user_id,
        team_id: request.body.team_id,
        status: request.body.status,
        hidden: request.body.hidden,
        challenge_id: request.body.challenge_id,
        data: request.body.data,
      };
      const [entries, total] = await Promise.all([
        submissionService.listSummary(query, {
          limit: page_size,
          offset: (page - 1) * page_size,
        }),
        submissionService.getCount(query),
      ]);

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
