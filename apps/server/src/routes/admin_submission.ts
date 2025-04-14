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
    async (request) => ({ data: await submissionService.query(request.body) }),
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
