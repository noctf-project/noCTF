import {
  AdminQuerySubmissions,
  AdminUpdateSubmissions,
} from "@noctf/api/contract/admin_submission";
import { ActorType } from "@noctf/server-core/types/enums";
import "@noctf/server-core/types/fastify";
import { OffsetPaginate } from "@noctf/server-core/util/paginator";
import { Policy } from "@noctf/server-core/util/policy";
import { route } from "@noctf/server-core/util/route";
import type { FastifyInstance } from "fastify";

export const PAGE_SIZE = 60;

export async function routes(fastify: FastifyInstance) {
  const { submissionService } = fastify.container.cradle;

  const auth = {
    require: true,
    scopes: new Set(["admin"]),
  };

  route(
    fastify,
    AdminQuerySubmissions,
    {
      auth: {
        ...auth,
        policy: ["admin.submission.get"] as Policy,
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

  route(
    fastify,
    AdminUpdateSubmissions,
    {
      auth: {
        ...auth,
        policy: ["admin.submission.update"] as Policy,
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
