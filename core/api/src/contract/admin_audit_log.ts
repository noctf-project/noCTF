import { QueryAuditLogRequest } from "../requests.ts";
import { QueryAuditLogResponse } from "../responses.ts";
import { RouteDef } from "../types.ts";

export const AdminQueryAuditLog = {
  method: "POST",
  url: "/admin/audit_log/query",
  schema: {
    tags: ["admin"],
    body: QueryAuditLogRequest,
    response: {
      200: QueryAuditLogResponse,
    },
  },
} as const satisfies RouteDef;
