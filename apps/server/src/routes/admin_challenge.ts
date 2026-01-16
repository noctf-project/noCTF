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
  BaseResponse,
} from "@noctf/api/responses";
import { FilterChallengesQuery } from "@noctf/api/query";
import { ActorType } from "@noctf/server-core/types/enums";
import type { FastifyInstance } from "fastify";
import { IdOrSlugParams, IdParams } from "@noctf/api/params";

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
        response: {
          200: AdminGetScoringStrategiesResponse,
        },
      },
      config: {
        auth: {
          require: true,
          policy: ["admin.challenge.get"],
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
        querystring: FilterChallengesQuery,
        response: {
          200: AdminListChallengesResponse,
        },
      },
      config: {
        auth: {
          require: true,
          policy: ["admin.challenge.get"],
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
        body: AdminCreateChallengeRequest,
        response: {
          201: AdminGetChallengeResponse,
        },
      },
      config: {
        auth: {
          require: true,
          policy: ["admin.challenge.create"],
        },
      },
    },
    async (request, reply) => {
      const result = await challengeService.create(request.body, {
        type: ActorType.USER,
        id: request.user.id,
      });
      return reply.status(201).send({
        data: result,
      });
    },
  );

  fastify.get<{
    Params: IdOrSlugParams;
    Reply: AdminGetChallengeResponse;
  }>(
    "/admin/challenges/:id",
    {
      schema: {
        tags: ["admin"],
        security: [{ bearer: [] }],
        params: IdOrSlugParams,
        response: {
          200: AdminGetChallengeResponse,
        },
      },
      config: {
        auth: {
          require: true,
          policy: ["admin.challenge.get"],
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
    Params: IdParams;
    Body: AdminUpdateChallengeRequest;
    Reply: AdminUpdateChallengeResponse;
  }>(
    "/admin/challenges/:id",
    {
      schema: {
        tags: ["admin"],
        security: [{ bearer: [] }],
        params: IdParams,
        body: AdminUpdateChallengeRequest,
        response: {
          200: AdminUpdateChallengeResponse,
        },
      },
      config: {
        auth: {
          require: true,
          policy: ["admin.challenge.update"],
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
    Params: IdParams;
  }>(
    "/admin/challenges/:id",
    {
      schema: {
        tags: ["admin"],
        security: [{ bearer: [] }],
        params: IdParams,
        response: {
          200: BaseResponse,
        },
      },
      config: {
        auth: {
          require: true,
          policy: ["admin.challenge.delete"],
        },
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
        response: {
          200: AnyResponse,
        },
      },
      config: {
        auth: {
          require: true,
          policy: [
            "OR",
            "admin.challenge.create",
            "admin.challenge.get",
            "admin.challenge.update",
          ],
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
