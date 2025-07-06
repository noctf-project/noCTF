import { IdParams } from "@noctf/api/params";
import {
  AdminQueryUsersRequest,
  AdminUpdateUserRequest,
} from "@noctf/api/requests";
import { AdminListUsersResponse, BaseResponse } from "@noctf/api/responses";
import { ForbiddenError, NotFoundError } from "@noctf/server-core/errors";
import { ActorType } from "@noctf/server-core/types/enums";
import { RunInParallelWithLimit } from "@noctf/server-core/util/semaphore";
import { FastifyInstance } from "fastify";

export const PAGE_SIZE = 60;

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

  fastify.put<{ Body: AdminUpdateUserRequest; Params: IdParams; Reply: BaseResponse }>(
    "/admin/user/:id",
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
      if (changed.includes("roles")) {
        const allowed = await policyService.evaluate(request.user.id, [
          "admin.policy.update",
        ]);
        if (!allowed) throw new ForbiddenError("Not allowed to update roles");
      }

      await userService.update(
        request.user.id,
        {
          name: request.body.name,
          bio: request.body.bio,
          flags: [...sFlags],
          roles: [...sRoles],
        },
        {
          actor: {
            type: ActorType.USER,
            id: request.user.id,
          },
          message: `Properties ${changed.join(", ")} were updated.`,
        },
      );
      return {};
    },
  );
}
