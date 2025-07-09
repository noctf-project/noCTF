import type { ServiceCradle } from "@noctf/server-core";
import type { FastifyInstance } from "fastify";
import "@noctf/server-core/types/fastify";
import { ActorType } from "@noctf/server-core/types/enums";
import { QueryUsersRequest, UpdateUserRequest } from "@noctf/api/requests";
import {
  BaseResponse,
  ListUserIdentitiesResponse,
  ListUsersResponse,
  MeUserResponse,
} from "@noctf/api/responses";
import { ConflictError, NotFoundError } from "@noctf/server-core/errors";
import { Policy } from "@noctf/server-core/util/policy";
import { Paginate } from "@noctf/server-core/util/paginator";

export async function routes(fastify: FastifyInstance) {
  const { userService, teamService, policyService, identityService } = fastify
    .container.cradle as ServiceCradle;

  const adminPolicy: Policy = ["admin.user.get"];

  fastify.get<{ Reply: MeUserResponse }>(
    "/user/me",
    {
      schema: {
        security: [{ bearer: [] }],
        tags: ["user"],
        auth: {
          require: true,
          policy: ["user.self"],
        },
        response: {
          200: MeUserResponse,
        },
      },
    },
    async (request) => {
      const membership = await request.user?.membership;
      const teamDetails = membership?.team_id
        ? await teamService.get(membership?.team_id)
        : null;
      const user = await userService.get(request.user.id);
      if (!user) throw new NotFoundError("User not found");
      return {
        data: {
          ...user,
          is_admin: !!(await policyService.evaluatePrefixes(user.id, ["admin"]))
            .length,
          team_id: membership?.team_id || null,
          division_id: teamDetails?.division_id || null,
          team_name: teamDetails?.name || null,
        },
      };
    },
  );

  fastify.get<{
    Reply: ListUserIdentitiesResponse;
  }>(
    "/user/me/identities",
    {
      schema: {
        security: [{ bearer: [] }],
        tags: ["auth"],
        auth: {
          require: true,
          policy: ["user.self.get"],
        },
        response: {
          200: ListUserIdentitiesResponse,
        },
      },
    },
    async (request) => {
      const identities = await identityService.listProvidersForUser(
        request.user.id,
      );
      return {
        data: identities,
      };
    },
  );

  fastify.put<{ Body: UpdateUserRequest; Reply: BaseResponse }>(
    "/user/me",
    {
      schema: {
        security: [{ bearer: [] }],
        tags: ["user"],
        auth: {
          require: true,
          policy: ["user.self.update"],
        },
        body: UpdateUserRequest,
        response: {
          200: BaseResponse,
        },
      },
    },
    async (request) => {
      const { name, bio } = request.body;
      const ex = await userService.get(request.user.id);
      if (!ex) throw new NotFoundError("User not found");
      const changed = [
        name !== ex.name && "name",
        bio !== ex.bio && "bio",
      ].filter((x) => x);
      if (changed.length === 0) return {};
      if (changed.includes("name")) {
        const id = await userService.getIdForName(name);
        if (id && id !== request.user.id)
          throw new ConflictError("A user already exists with this name");
      }

      await userService.update(
        request.user.id,
        {
          name,
          bio,
        },
        {
          actor: {
            type: ActorType.USER,
            id: request.user.id,
          },
          message: `Properties ${changed.join(", ")} were updated`,
        },
      );
      return {};
    },
  );

  fastify.post<{ Reply: ListUsersResponse; Body: QueryUsersRequest }>(
    "/users/query",
    {
      schema: {
        security: [{ bearer: [] }],
        tags: ["user"],
        auth: {
          require: true,
          policy: ["user.get"],
        },
        body: QueryUsersRequest,
        response: {
          200: ListUsersResponse,
        },
      },
    },
    async (request) => {
      const admin = await policyService.evaluate(request.user?.id, adminPolicy);
      const { page, page_size, ...query } = request.body;
      const [result, total] = await Promise.all([
        Paginate(
          {
            ...query,
            flags: admin ? [] : ["!hidden"],
          },
          { page, page_size },
          (q, l) => userService.listSummary(q, l),
        ),
        query.ids && query.ids.length ? userService.getCount(query) : 0,
      ]);
      return {
        data: {
          ...result,
          total: total || result.entries.length,
        },
      };
    },
  );
}
