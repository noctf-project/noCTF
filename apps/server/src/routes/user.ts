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
import { NotFoundError } from "@noctf/server-core/errors";
import { Policy } from "@noctf/server-core/util/policy";

export const PAGE_SIZE = 60;

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
      const x = await userService.get(request.user.id);
      if (!x) throw new NotFoundError("User not found");
      const changed = [
        name !== x.name && "name",
        bio !== x.bio && "bio",
      ].filter((x) => x);
      if (changed.length === 0) return {};

      await userService.update(
        request.user.id,
        {
          name: request.body.name,
          bio: request.body.bio,
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

      const page = request.body.page || 1;
      const page_size =
        (admin
          ? request.body.page_size
          : Math.min(PAGE_SIZE, request.body.page_size)) || PAGE_SIZE;

      const query = {
        flags: admin ? [] : ["!hidden"],
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
