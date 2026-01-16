import {
  AdminCreatePolicy,
  AdminDeletePolicy,
  AdminListPolicies,
  AdminUpdatePolicy,
} from "@noctf/api/contract/admin_policy";
import { ActorType } from "@noctf/server-core/types/enums";
import { route } from "@noctf/server-core/util/route";
import { FastifyInstance } from "fastify";

export async function routes(fastify: FastifyInstance) {
  const { policyService } = fastify.container.cradle;

  route(
    fastify,
    AdminListPolicies,
    {
      auth: {
        require: true,
        policy: ["admin.policy.get"],
      },
    },
    async () => {
      return {
        data: await policyService.list(),
      };
    },
  );

  route(
    fastify,
    AdminCreatePolicy,
    {
      auth: {
        require: true,
        policy: ["admin.policy.manage"],
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

  route(
    fastify,
    AdminUpdatePolicy,
    {
      auth: {
        require: true,
        policy: ["admin.policy.manage"],
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

  route(
    fastify,
    AdminDeletePolicy,
    {
      auth: {
        require: true,
        policy: ["admin.policy.manage"],
      },
    },
    async (request) => {
      await policyService.delete(request.params.id, undefined, {
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
