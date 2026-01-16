import { AdminQueryAuditLog } from "@noctf/api/contract/admin_audit_log";
import "@noctf/server-core/types/fastify";
import { route } from "@noctf/server-core/util/route";
import type { FastifyInstance } from "fastify";

export async function routes(fastify: FastifyInstance) {
  const { auditLogService } = fastify.container.cradle;

  route(
    fastify,
    AdminQueryAuditLog,
    {
      auth: {
        require: true,
        scopes: new Set(["admin"]),
        policy: ["admin.audit_log.get"],
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
