import { QueryAuditLogRequest } from "@noctf/api/requests";
import { QueryAuditLogResponse } from "@noctf/api/responses";
import type { FastifyInstance } from "fastify";
import "@noctf/server-core/types/fastify";

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
      const { page_size, ...query } = request.body;
      const limit = Math.min(Math.max(0, page_size), 1000);
      const entries = await auditLogService.query(query, limit);
      return {
        data: {
          entries,
          page_size: limit,
        },
      };
    },
  );
}
