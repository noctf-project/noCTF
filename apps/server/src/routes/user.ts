import {
  GetMe,
  GetMeIdentities,
  QueryUsers,
  UpdateMe,
} from "@noctf/api/contract/user";
import { ConflictError, NotFoundError } from "@noctf/server-core/errors";
import { ActorType } from "@noctf/server-core/types/enums";
import "@noctf/server-core/types/fastify";
import { OffsetPaginate } from "@noctf/server-core/util/paginator";
import { Policy } from "@noctf/server-core/util/policy";
import { route } from "@noctf/server-core/util/route";
import type { ServiceCradle } from "@noctf/server-core";
import { FastifyInstance } from "fastify";
import { GetUtils } from "./_util.ts";

export async function routes(fastify: FastifyInstance) {
  const { userService, teamService, policyService, identityService } = fastify
    .container.cradle as ServiceCradle;

  const adminPolicy: Policy = ["admin.user.get"];

  const { getMaxPageSize } = GetUtils(fastify.container.cradle);

  route(
    fastify,
    GetMe,
    {
      auth: {
        require: true,
        policy: ["user.self.get"],
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

  route(
    fastify,
    GetMeIdentities,
    {
      auth: {
        require: true,
        policy: ["user.self.get"],
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

  route(
    fastify,
    UpdateMe,
    {
      auth: {
        require: true,
        policy: ["user.self.update"],
      },
    },
    async (request) => {
      const { name, bio, country } = request.body;
      const ex = await userService.get(request.user.id);
      if (!ex) throw new NotFoundError("User not found");
      const changed = [
        name !== ex.name && "name",
        bio !== ex.bio && "bio",
        country !== ex.country && "country",
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
          country,
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

  route(
    fastify,
    QueryUsers,
    {
      auth: {
        policy: ["user.get"],
      },
    },
    async (request) => {
      const admin = await policyService.evaluate(request.user?.id, adminPolicy);
      const { page, page_size, ...query } = request.body;
      const q = {
        ...query,
        flags: admin ? [] : ["!hidden"],
      };
      const [result, total] = await Promise.all([
        OffsetPaginate(
          q,
          { page, page_size },
          (q, l) => userService.listSummary(q, l),
          {
            max_page_size: await getMaxPageSize(
              ["bypass.page_size.user"],
              request.user?.id,
            ),
          },
        ),
        q.ids && q.ids.length ? 0 : userService.getCount(q),
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
