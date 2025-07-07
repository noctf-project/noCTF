import { IdParams } from "@noctf/api/params";
import { SessionQuery } from "@noctf/api/query";
import {
  AdminQueryUsersRequest,
  AdminUpdateUserRequest,
} from "@noctf/api/requests";
import {
  AdminListUsersResponse,
  BaseResponse,
  ListSessionsResponse,
} from "@noctf/api/responses";
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from "@noctf/server-core/errors";
import { ActorType } from "@noctf/server-core/types/enums";
import { Policy } from "@noctf/server-core/util/policy";
import { RunInParallelWithLimit } from "@noctf/server-core/util/semaphore";
import { FastifyInstance } from "fastify";

export const PAGE_SIZE = 60;

const PRIVILEGED_POLICY: Policy = ["admin.policy.manage"];

export async function routes(fastify: FastifyInstance) {
  const { userService, policyService, identityService } =
    fastify.container.cradle;

  fastify.post<{ Reply: AdminListUsersResponse; Body: AdminQueryUsersRequest }>(
    "/admin/users/query",
    {
      schema: {
        security: [{ bearer: [] }],
        tags: ["admin"],
        auth: {
          require: true,
          policy: ["admin.user.get"],
        },
        body: AdminQueryUsersRequest,
        response: {
          200: AdminListUsersResponse,
        },
      },
    },
    async (request) => {
      const page = request.body.page || 1;
      const page_size = request.body.page_size ?? PAGE_SIZE;
      const canViewIdentity = await policyService.evaluate(request.user.id, [
        "admin.identity.get",
      ]);

      const query = request.body;
      const [entries, total] = await Promise.all([
        userService.listSummary(query, {
          limit: page_size,
          offset: (page - 1) * page_size,
        }),
        !(query.ids && query.ids.length) ? userService.getCount(query) : 0,
      ]);

      const results = await RunInParallelWithLimit(entries, 8, async (e) => ({
        ...e,
        derived_roles: [...(await policyService.computeRolesForUser(e))],
        identities: await identityService.listProvidersForUser(e.id),
      }));
      const derivedEntries: AdminListUsersResponse["data"]["entries"] = [];
      for (const r of results) {
        if (r.status !== "fulfilled") throw r.reason;
        derivedEntries.push(r.value);
        if (!canViewIdentity && r.value.id !== request.user.id) {
          r.value.identities = r.value.identities.map((x) => ({
            ...x,
            provider_id: "<hidden>",
          }));
        }
      }

      return {
        data: {
          entries: derivedEntries,
          page_size,
          total: total || entries.length,
        },
      };
    },
  );

  fastify.put<{
    Body: AdminUpdateUserRequest;
    Params: IdParams;
    Reply: BaseResponse;
  }>(
    "/admin/users/:id",
    {
      schema: {
        security: [{ bearer: [] }],
        tags: ["admin"],
        auth: {
          require: true,
          policy: ["admin.user.update"],
        },
        body: AdminUpdateUserRequest,
        params: IdParams,
        response: {
          200: BaseResponse,
        },
      },
    },
    async (request) => {
      const ex = await userService.get(request.params.id);
      if (!ex) throw new NotFoundError("User not found");
      const { name, bio, flags, roles } = request.body;

      const sFlags = new Set(flags);
      const sRoles = new Set(roles);

      const changed = [
        name !== ex.name && "name",
        bio !== ex.bio && "bio",
        sRoles.symmetricDifference(new Set(ex.roles)).size > 0 && "roles",
        sFlags.symmetricDifference(new Set(ex.flags)).size > 0 && "flags",
      ].filter((x) => x);

      if (changed.length === 0) return {};
      if (changed.includes("roles")) {
        const allowed = await policyService.evaluate(
          request.user.id,
          PRIVILEGED_POLICY,
        );
        if (!allowed) throw new ForbiddenError("Not allowed to update roles");
      }

      if (changed.includes("name")) {
        const id = await userService.getIdForName(name);
        if (id && id !== request.user.id)
          throw new ConflictError("A user already exists with this name");
      }

      await userService.update(
        request.params.id,
        {
          name,
          bio,
          flags: [...sFlags],
          roles: [...sRoles],
        },
        {
          actor: {
            type: ActorType.USER,
            id: request.user.id,
          },
          message: `Properties ${changed.join(", ")} were updated by admin`,
        },
      );
      return {};
    },
  );

  fastify.delete<{
    Reply: BaseResponse;
    Params: IdParams;
  }>(
    "/admin/users/:id",
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
          policy: ["admin.user.delete"],
        },
      },
    },
    async (request) => {
      if (request.user.id === request.params.id)
        throw new BadRequestError("You cannot delete yourself");
      const me = await policyService.evaluate(
        request.user.id,
        PRIVILEGED_POLICY,
      );
      const test = await policyService.evaluate(
        request.params.id,
        PRIVILEGED_POLICY,
      );
      if (test && !me)
        throw new ForbiddenError(
          "Not allowed to delete a user with higher privilege",
        );
      await userService.delete(request.params.id, {
        actor: {
          type: ActorType.USER,
          id: request.user.id,
        },
        message: "User deleted by admin",
      });
      return {};
    },
  );

  fastify.get<{
    Querystring: SessionQuery;
    Params: IdParams;
    Reply: ListSessionsResponse;
  }>(
    "/admin/users/:id/sessions",
    {
      schema: {
        security: [{ bearer: [] }],
        tags: ["admin"],
        auth: {
          require: true,
          policy: ["admin.session.get"],
        },
        params: IdParams,
        querystring: SessionQuery,
        response: {
          200: ListSessionsResponse,
        },
      },
    },
    async (request) => {
      const page = request.query.page || 1;
      const page_size = request.query.page_size ?? PAGE_SIZE;
      const [entries, total] = await Promise.all([
        identityService.listSessionsForUser(
          request.params.id,
          request.query.active,
          {
            limit: page_size,
            offset: (page - 1) * page_size,
          },
        ),
        identityService.countSessionsForUser(
          request.params.id,
          request.query.active,
        ),
      ]);
      return {
        data: {
          page_size,
          total,
          entries,
        },
      };
    },
  );
}
