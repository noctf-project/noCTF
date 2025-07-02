import { AdminQueryUsersRequest } from "@noctf/api/requests";
import { AdminListUsersResponse } from "@noctf/api/responses";
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
}
