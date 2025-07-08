import { IdParams } from "@noctf/api/params";
import {
  AdminCreatePolicyRequest,
  AdminUpdatePolicyRequest,
} from "@noctf/api/requests";
import {
  AdminListPolicyResponse,
  AdminPolicyResponse,
  BaseResponse,
} from "@noctf/api/responses";
import { ActorType } from "@noctf/server-core/types/enums";
import { FastifyInstance } from "fastify";

export async function routes(fastify: FastifyInstance) {
  const { policyService } = fastify.container.cradle;

  fastify.get<{ Reply: AdminListPolicyResponse }>(
    "/admin/policies",
    {
      schema: {
        security: [{ bearer: [] }],
        tags: ["admin"],
        response: {
          200: AdminListPolicyResponse,
        },
        auth: {
          require: true,
          policy: ["admin.policy.get"],
        },
      },
    },
    async () => {
      return {
        data: await policyService.list(),
      };
    },
  );

  fastify.post<{
    Reply: AdminPolicyResponse;
    Body: AdminCreatePolicyRequest;
  }>(
    "/admin/policies",
    {
      schema: {
        security: [{ bearer: [] }],
        tags: ["admin"],
        response: {
          200: AdminPolicyResponse,
        },
        body: AdminCreatePolicyRequest,
        auth: {
          require: true,
          policy: ["admin.policy.manage"],
        },
      },
    },
    async (request) => {
      return {
        data: await policyService.create(request.body, {
          actor: {
            type: ActorType.USER,
            id: request.user.id,
          },
          message: "Policy created",
        }),
      };
    },
  );

  fastify.put<{
    Reply: BaseResponse;
    Body: AdminUpdatePolicyRequest;
    Params: IdParams;
  }>(
    "/admin/policies/:id",
    {
      schema: {
        security: [{ bearer: [] }],
        tags: ["admin"],
        response: {
          200: BaseResponse,
        },
        params: IdParams,
        body: AdminUpdatePolicyRequest,
        auth: {
          require: true,
          policy: ["admin.policy.manage"],
        },
      },
    },
    async (request) => {
      await policyService.update(request.params.id, request.body, {
        actor: {
          type: ActorType.USER,
          id: request.user.id,
        },
        message: "Policy updated",
      });
      return {};
    },
  );

  fastify.delete<{ Reply: BaseResponse; Params: IdParams }>(
    "/admin/policies/:id",
    {
      schema: {
        security: [{ bearer: [] }],
        tags: ["admin"],
        response: {
          200: BaseResponse,
        },
        params: IdParams,
        auth: {
          require: true,
          policy: ["admin.policies.manage"],
        },
      },
    },
    async (request) => {
      await policyService.delete(request.params.id, {
        actor: {
          type: ActorType.USER,
          id: request.user.id,
        },
        message: "Policy deleted",
      });
      return {};
    },
  );
}
