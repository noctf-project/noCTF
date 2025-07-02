import type { ServiceCradle } from "@noctf/server-core";
import type { FastifyInstance } from "fastify";
import "@noctf/server-core/types/fastify";
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  NotImplementedError,
} from "@noctf/server-core/errors";
import {
  CreateTeamRequest,
  JoinTeamRequest,
  QueryTeamsRequest,
  UpdateTeamRequest,
} from "@noctf/api/requests";
import {
  ListDivisionsResponse,
  ListTeamsResponse,
  ListTeamTagsResponse,
  MeTeamResponse,
  SuccessResponse,
} from "@noctf/api/responses";
import { ActorType, TeamFlag } from "@noctf/server-core/types/enums";
import { Policy } from "@noctf/server-core/util/policy";
import SingleValueCache from "@noctf/server-core/util/single_value_cache";

export const PAGE_SIZE = 60;

export async function routes(fastify: FastifyInstance) {
  const adminPolicy: Policy = ["admin.team.get"];
  const { teamService, policyService } = fastify.container
    .cradle as ServiceCradle;

  const divisionsGetter = new SingleValueCache(
    () => teamService.listDivisions(),
    2000,
  );
  const tagsGetter = new SingleValueCache(() => teamService.listTags(), 3000);

  fastify.get<{ Reply: ListDivisionsResponse }>(
    "/divisions",
    {
      schema: {
        security: [{ bearer: [] }],
        tags: ["division"],
        auth: {
          policy: ["OR", "team.self.get", "division.get", "scoreboard.get"],
        },
        response: {
          200: ListDivisionsResponse,
        },
      },
    },
    async (request) => {
      const canList = policyService.evaluate(request.user?.id, [
        "division.get",
      ]);
      if (!canList && !request.user) {
        return { data: [] };
      }
      const membership = await request.user?.membership;
      if (!canList) {
        if (!membership) return { data: [] };
        const division = await teamService.getDivision(membership.division_id);
        if (!division) return { data: [] };
        return { data: [{ ...division, is_password: !!division.password }] };
      }
      return {
        data: (await divisionsGetter.get())
          .filter(
            ({ is_visible, id }) =>
              is_visible || membership?.division_id === id,
          )
          .map((x) => ({ ...x, is_password: !!x.password })),
      };
    },
  );

  fastify.get<{ Reply: ListTeamTagsResponse }>(
    "/team_tags",
    {
      schema: {
        security: [{ bearer: [] }],
        tags: ["team"],
        response: {
          200: ListTeamTagsResponse,
        },
        auth: {
          policy: ["team.get"],
        },
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

  fastify.post<{ Body: CreateTeamRequest; Reply: MeTeamResponse }>(
    "/teams",
    {
      schema: {
        security: [{ bearer: [] }],
        tags: ["team"],
        auth: {
          require: true,
          policy: ["team.create"],
        },
        body: CreateTeamRequest,
        response: {
          201: MeTeamResponse,
        },
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
      await teamService.validateJoinDivision(
        request.body.division_id,
        request.body.division_password,
      );
      const team = await teamService.create(
        {
          name: request.body.name,
          division_id: request.body.division_id,
          tag_ids: request.body.tag_ids,
          generate_join_code: true,
        },
        {
          actor,
          message: "Created a team using self-service.",
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
          message: "Assigned owner permissions to the team's creator.",
        },
      );
      return reply.status(201).send({
        data: team,
      });
    },
  );

  fastify.post<{ Body: JoinTeamRequest; Reply: MeTeamResponse }>(
    "/team/join",
    {
      schema: {
        tags: ["team"],
        security: [{ bearer: [] }],
        auth: {
          require: true,
          policy: ["team.self.join"],
        },
        body: JoinTeamRequest,
        response: {
          201: MeTeamResponse,
        },
      },
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

  fastify.delete(
    "/team/join",
    {
      schema: {
        security: [{ bearer: [] }],
        tags: ["team"],
        auth: {
          require: true,
          policy: ["team.self.leave"],
        },
      },
    },
    async () => {
      throw new NotImplementedError();
    },
  );

  fastify.get<{ Reply: MeTeamResponse }>(
    "/team",
    {
      schema: {
        security: [{ bearer: [] }],
        tags: ["team"],
        auth: {
          require: true,
          policy: ["team.self.get"],
        },
        response: {
          200: MeTeamResponse,
        },
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

  fastify.put<{ Body: UpdateTeamRequest; Reply: SuccessResponse }>(
    "/team",
    {
      schema: {
        security: [{ bearer: [] }],
        tags: ["team"],
        auth: {
          require: true,
          policy: ["team.self.update"],
        },
        body: UpdateTeamRequest,
        response: {
          200: SuccessResponse,
        },
      },
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
      await teamService.update(membership.team_id, request.body, {
        actor: {
          type: ActorType.USER,
          id: request.user.id,
        },
      });
      return {
        data: true,
      };
    },
  );

  fastify.post<{ Body: QueryTeamsRequest; Reply: ListTeamsResponse }>(
    "/teams/query",
    {
      schema: {
        security: [{ bearer: [] }],
        tags: ["team"],
        response: {
          200: ListTeamsResponse,
        },
        body: QueryTeamsRequest,
        auth: {
          policy: ["team.get"],
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
        flags: ["!hidden"],
        division_id: request.body.division_id,
        name_prefix: request.body.name_prefix,
        ids: request.body.ids,
      };
      const [entries, total] = await Promise.all([
        teamService.listSummary(query, {
          limit: page_size,
          offset: (page - 1) * page_size,
          sort_order: request.body.sort_order || "asc",
        }),
        !(query.ids && query.ids.length) ? teamService.getCount(query) : 0,
      ]);

      return {
        data: { entries, page_size, total: total || entries.length },
      };
    },
  );
}
