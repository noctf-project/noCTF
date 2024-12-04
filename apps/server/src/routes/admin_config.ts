import { UpdateConfigValueRequest } from "@noctf/api/requests";
import { GetAdminConfigValueResponse } from "@noctf/api/responses";
import { AuthHook } from "@noctf/server-core/hooks/auth";
import { AuthzFlagHook } from "@noctf/server-core/hooks/authz";
import { AuditLogOperation } from "@noctf/server-core/types/audit_log";
import { FastifyInstance } from "fastify";

export async function routes(fastify: FastifyInstance) {
  const { configService, auditLogService } = fastify.container.cradle;

  fastify.addHook("preHandler", AuthHook("admin"));
  fastify.addHook("preHandler", AuthzFlagHook("admin"));

  fastify.get(
    "/admin/config",
    {
      schema: {
        tags: ["admin"],
        security: [{ bearer: [] }],
      },
    },
    () => ({ data: configService.getSchemas() }),
  );
  fastify.get<{
    Params: {
      namespace: string;
    };
    Reply: GetAdminConfigValueResponse;
  }>(
    "/admin/config/:namespace",
    {
      schema: {
        tags: ["admin"],
        security: [{ bearer: [] }],
        response: {
          200: GetAdminConfigValueResponse,
        },
      },
    },
    async (request) => {
      return {
        data: await configService.get(request.params.namespace, true),
      };
    },
  );
  fastify.put<{
    Params: {
      namespace: string;
    };
    Body: UpdateConfigValueRequest;
  }>(
    "/admin/config/:namespace",
    {
      schema: {
        tags: ["admin"],
        security: [{ bearer: [] }],
        body: UpdateConfigValueRequest,
      },
    },
    async (request) => {
      const data = await configService.update(
        request.params.namespace,
        request.body.value,
        request.body.version,
      );
      await auditLogService.logUser(
        AuditLogOperation.ConfigUpdate,
        request.user,
        request.params.namespace,
        JSON.stringify(data.value),
      );
      return {
        data,
      };
    },
  );
}
