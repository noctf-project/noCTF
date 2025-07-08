import { QueryAuditLogRequest } from "@noctf/api/requests";
import { QueryAuditLogResponse } from "@noctf/api/responses";
import type { FastifyInstance } from "fastify";
import "@noctf/server-core/types/fastify";
import { Paginate } from "@noctf/server-core/util/paginator";

export async function routes(fastify: FastifyInstance) {
  const { auditLogService } = fastify.container.cradle;

  fastify.post<{ Body: QueryAuditLogRequest; Reply: QueryAuditLogResponse }>(
    "/admin/audit_log/query",
    {
      schema: {
        tags: ["admin"],
        security: [{ bearer: [] }],
        auth: {
          require: true,
          scopes: new Set(["admin"]),
          policy: ["admin.audit_log.get"],
        },
        body: QueryAuditLogRequest,
        response: {
          200: QueryAuditLogResponse,
        },
      },
    },
    async (request) => {
      const { page, page_size, ...query } = request.body;
      const [result, total] = await Promise.all([
        Paginate(query, { page, page_size }, (q, l) =>
          auditLogService.query(q, l),
        ),
        auditLogService.getCount(query),
      ]);
      return {
        data: {
          ...result,
          total: total || result.entries.length,
        },
      };
    },
  );
}
