import { QueryAuditLogRequest } from "@noctf/api/requests";
import { QueryAuditLogResponse } from "@noctf/api/responses";
import { FastifyInstance } from "fastify";
import "@noctf/server-core/types/fastify";
import { Policy } from "@noctf/server-core/util/policy";

export async function routes(fastify: FastifyInstance) {
  const { auditLogService } = fastify.container.cradle;

  const auth = {
    require: true,
    scopes: new Set(["admin"]),
    policy: ["AND", "admin.audit_log:r"] as Policy,
  };

  fastify.post(
    "/admin/audit_log",
    {
      schema: {
        tags: ["admin"],
        security: [{ bearer: [] }],
        auth,
        body: QueryAuditLogRequest,
        response: {
          200: QueryAuditLogResponse,
        },
      },
    },
    async (request) => ({ data: await auditLogService.query(request.body) }),
  );
}
