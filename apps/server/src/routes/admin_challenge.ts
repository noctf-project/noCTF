import { GetChallengeParams } from "@noctf/api/params";
import {
  AdminCreateChallengeRequest,
  AdminUpdateChallengeRequest,
} from "@noctf/api/requests";
import {
  AdminGetChallengeResponse,
  AdminGetScoringStrategiesResponse,
  AdminListChallengesResponse,
  AdminUpdateChallengeResponse,
  AnyResponse,
} from "@noctf/api/responses";
import { FilterChallengesQuery } from "@noctf/api/query";
import { ActorType } from "@noctf/server-core/types/enums";
import type { FastifyInstance } from "fastify";

export async function routes(fastify: FastifyInstance) {
  const { challengeService, scoreService } = fastify.container.cradle;

  fastify.get<{
    Reply: AdminGetScoringStrategiesResponse;
  }>(
    "/admin/scoring_strategies",
    {
      schema: {
        tags: ["admin"],
        security: [{ bearer: [] }],
        auth: {
          require: true,
          policy: ["admin.challenge.get"],
        },
        response: {
          200: AdminGetScoringStrategiesResponse,
        },
      },
    },
    async () => {
      return {
        data: await scoreService.getStrategies(),
      };
    },
  );

  fastify.get<{
    Querystring: FilterChallengesQuery;
    Reply: AdminListChallengesResponse;
  }>(
    "/admin/challenges",
    {
      schema: {
        tags: ["admin"],
        security: [{ bearer: [] }],
        auth: {
          require: true,
          policy: ["admin.challenge.get"],
        },
        querystring: FilterChallengesQuery,
        response: {
          200: AdminListChallengesResponse,
        },
      },
    },
    async (request) => {
      return {
        data: await challengeService.list(request.query),
      };
    },
  );

  fastify.post<{
    Body: AdminCreateChallengeRequest;
    Reply: AdminGetChallengeResponse;
  }>(
    "/admin/challenges",
    {
      schema: {
        tags: ["admin"],
        security: [{ bearer: [] }],
        auth: {
          require: true,
          policy: ["admin.challenge.create"],
        },
        body: AdminCreateChallengeRequest,
        response: {
          201: AdminGetChallengeResponse,
        },
      },
    },
    async (request) => {
      return {
        data: await challengeService.create(request.body, {
          type: ActorType.USER,
          id: request.user.id,
        }),
      };
    },
  );

  fastify.get<{
    Params: GetChallengeParams;
    Reply: AdminGetChallengeResponse;
  }>(
    "/admin/challenges/:id",
    {
      schema: {
        tags: ["admin"],
        security: [{ bearer: [] }],
        auth: {
          require: true,
          policy: ["admin.challenge.create"],
        },
        params: GetChallengeParams,
        response: {
          200: AdminGetChallengeResponse,
        },
      },
    },
    async (request) => {
      return {
        data: await challengeService.get(request.params.id, false),
      };
    },
  );

  fastify.put<{
    Params: GetChallengeParams;
    Body: AdminUpdateChallengeRequest;
    Reply: AdminUpdateChallengeResponse;
  }>(
    "/admin/challenges/:id",
    {
      schema: {
        tags: ["admin"],
        security: [{ bearer: [] }],
        auth: {
          require: true,
          policy: ["admin.challenge.update"],
        },
        params: GetChallengeParams,
        body: AdminUpdateChallengeRequest,
        response: {
          200: AdminUpdateChallengeResponse,
        },
      },
    },
    async (request) => {
      return {
        data: {
          version: await challengeService.update(
            request.params.id,
            {
              version: 0,
              ...request.body,
            },
            {
              type: ActorType.USER,
              id: request.user.id,
            },
          ),
        },
      };
    },
  );

  fastify.delete<{
    Params: GetChallengeParams;
  }>(
    "/admin/challenges/:id",
    {
      schema: {
        tags: ["admin"],
        security: [{ bearer: [] }],
        auth: {
          require: true,
          policy: ["admin.challenge.delete"],
        },
        params: GetChallengeParams,
      },
    },
    async (request) => {
      await challengeService.delete(request.params.id);
      return {};
    },
  );

  fastify.get(
    "/admin/challenges/schema/private_metadata",
    {
      schema: {
        tags: ["admin"],
        security: [{ bearer: [] }],
        auth: {
          require: true,
          policy: [
            "OR",
            "admin.challenge.create",
            "admin.challenge.get",
            "admin.challenge.update",
          ],
        },
        response: {
          200: AnyResponse,
        },
      },
    },
    () => {
      return {
        data: challengeService.getPrivateMetadataSchema(),
      };
    },
  );
}
