import { QueryUsersRequest } from "@noctf/api/requests";
import { AdminListUsersResponse } from "@noctf/api/responses";
import { FastifyInstance } from "fastify";

export const PAGE_SIZE = 60;

export async function routes(fastify: FastifyInstance) {
  const { userService } = fastify.container.cradle;

  fastify.post<{ Reply: AdminListUsersResponse; Body: QueryUsersRequest }>(
    "/admin/users/query",
    {
      schema: {
        security: [{ bearer: [] }],
        tags: ["user"],
        auth: {
          require: true,
          policy: ["admin.user.get"],
        },
        body: QueryUsersRequest,
        response: {
          200: AdminListUsersResponse,
        },
      },
    },
    async (request) => {
      const page = request.body.page || 1;
      const page_size = request.body.page_size ?? PAGE_SIZE;
      const query = {
        name_prefix: request.body.name_prefix,
        ids: request.body.ids,
      };
      const [entries, total] = await Promise.all([
        userService.listSummary(query, {
          limit: page_size,
          offset: (page - 1) * page_size,
        }),
        !(query.ids && query.ids.length) ? userService.getCount(query) : 0,
      ]);

      return {
        data: { entries, page_size, total: total || entries.length },
      };
    },
  );
}
