import {
  CreateTeam,
  GetMyTeam,
  JoinTeam,
  LeaveTeam,
  ListDivisions,
  ListTeamTags,
  QueryTeams,
  UpdateTeam,
} from "@noctf/api/contract/team";
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  NotImplementedError,
} from "@noctf/server-core/errors";
import { ActorType, TeamFlag } from "@noctf/server-core/types/enums";
import "@noctf/server-core/types/fastify";
import { GetRouteUserIPKey } from "@noctf/server-core/util/limit_keys";
import { OffsetPaginate } from "@noctf/server-core/util/paginator";
import { Policy } from "@noctf/server-core/util/policy";
import { route } from "@noctf/server-core/util/route";
import SingleValueCache from "@noctf/server-core/util/single_value_cache";
import type { ServiceCradle } from "@noctf/server-core";
import type { FastifyInstance } from "fastify";
import { GetUtils } from "./_util.ts";

export async function routes(fastify: FastifyInstance) {
  const adminPolicy: Policy = ["admin.team.get"];
  const { teamService, policyService, divisionService } = fastify.container
    .cradle as ServiceCradle;

  const { getMaxPageSize } = GetUtils(fastify.container.cradle);

  const divisionsGetter = new SingleValueCache(
    () => divisionService.list(),
    2000,
  );
  const tagsGetter = new SingleValueCache(() => teamService.listTags(), 3000);

  route(
    fastify,
    ListDivisions,
    {
      auth: {
        policy: ["OR", "team.self.get", "division.get", "scoreboard.get"],
      },
    },
    async (request) => {
      const canList = policyService.evaluate(request.user?.id, [
        "OR",
        "division.get",
        "admin.division.get",
      ]);
      if (!canList && !request.user) {
        return { data: [] };
      }
      const membership = await request.user?.membership;
      if (!canList) {
        if (!membership) return { data: [] };
        const division = await divisionService.get(membership.division_id);
        if (!division) return { data: [] };
        return { data: [{ ...division, is_password: !!division.password }] };
      }
      const admin = await policyService.evaluate(request.user?.id, [
        "admin.division.get",
      ]);
      return {
        data: (await divisionsGetter.get())
          .filter(
            ({ is_visible, id }) =>
              admin || is_visible || membership?.division_id === id,
          )
          .map((x) => ({ ...x, is_password: !!x.password })),
      };
    },
  );

  route(
    fastify,
    ListTeamTags,
    {
      auth: {
        policy: ["team.get"],
      },
    },
    async () => {
      return {
        data: {
          tags: await tagsGetter.get(),
        },
      };
    },
  );

  route(
    fastify,
    CreateTeam,
    {
      auth: {
        require: true,
        policy: ["team.create"],
      },
    },
    async (request, reply) => {
      if (await request.user?.membership) {
        throw new ConflictError("You are currently part of a team");
      }
      const actor = {
        type: ActorType.USER,
        id: request.user.id,
      };
      await divisionService.validateJoinable(
        request.body.division_id,
        request.body.division_password,
      );
      await teamService.validateTagsJoinable(request.body.tag_ids);
      const team = await teamService.create(
        {
          name: request.body.name,
          division_id: request.body.division_id,
          tag_ids: request.body.tag_ids,
          generate_join_code: true,
        },
        {
          actor,
          message: "Self-service team created",
        },
      );
      await teamService.assignMember(
        {
          team_id: team.id,
          user_id: request.user.id,
          role: "owner",
        },
        {
          actor: {
            type: ActorType.USER,
            id: request.user.id,
          },
          message: "Assigned owner permissions to the team's creator",
        },
      );
      return reply.status(201).send({
        data: {
          ...team,
          members: [{ user_id: request.user.id, role: "owner" }],
        },
      });
    },
  );

  route(
    fastify,
    JoinTeam,
    {
      auth: {
        require: true,
        policy: ["team.self.join"],
      },
      rateLimit: (r) => [
        {
          key: GetRouteUserIPKey(r),
          limit: 4,
          windowSeconds: 60,
        },
      ],
    },
    async (request, reply) => {
      const id = await teamService.join(
        request.user.id,
        request.body.join_code,
      );

      return reply.status(201).send({
        data: await teamService.get(id),
      });
    },
  );

  route(
    fastify,
    LeaveTeam,
    {
      auth: {
        require: true,
        policy: ["team.self.leave"],
      },
      rateLimit: (r) => [
        {
          key: GetRouteUserIPKey(r),
          limit: 1,
          windowSeconds: 60,
        },
      ],
    },
    async () => {
      throw new NotImplementedError();
    },
  );

  route(
    fastify,
    GetMyTeam,
    {
      auth: {
        require: true,
        policy: ["team.self.get"],
      },
    },
    async (request) => {
      const membership = await request.user?.membership;
      if (!membership) {
        throw new NotFoundError("You are not currently part of a team");
      }
      return {
        data: await teamService.get(membership.team_id),
      };
    },
  );

  route(
    fastify,
    UpdateTeam,
    {
      auth: {
        require: true,
        policy: ["team.self.update"],
      },
      rateLimit: (r) => [
        {
          key: GetRouteUserIPKey(r),
          limit: 3,
          windowSeconds: 60,
        },
      ],
    },
    async (request) => {
      const membership = await request.user?.membership;
      if (!membership) {
        throw new NotFoundError("You are not currently part of a team");
      }
      if (membership.role !== "owner") {
        throw new ForbiddenError("Only the team's owner can update the team");
      }
      const team = await teamService.get(membership.team_id);

      // after we verify teams, we don't want them to update it
      if (team.flags.includes(TeamFlag.FROZEN)) {
        throw new ForbiddenError("An admin has locked changes to your team.");
      }
      if (request.body.tag_ids) {
        const existing = team.tag_ids;
        const proposed = new Set(request.body.tag_ids);
        existing.forEach((x) => proposed.delete(x));
        await teamService.validateTagsJoinable([...proposed]);
      }

      const { join_code } = await teamService.update(
        membership.team_id,
        request.body,
        {
          actor: {
            type: ActorType.USER,
            id: request.user.id,
          },
        },
      );
      return {
        data: {
          join_code,
        },
      };
    },
  );

  route(
    fastify,
    QueryTeams,
    {
      auth: {
        policy: ["team.get"],
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
          (q, l) => teamService.listSummary(q, l),
          {
            max_page_size: await getMaxPageSize(
              ["bypass.page_size.team"],
              request.user?.id,
            ),
          },
        ),
        q.ids && q.ids.length ? 0 : teamService.getCount(q),
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
