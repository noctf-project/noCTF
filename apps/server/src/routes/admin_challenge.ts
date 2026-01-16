import {
  AdminCreateChallenge,
  AdminDeleteChallenge,
  AdminGetChallenge,
  AdminGetChallengePrivateMetadataSchema,
  AdminGetScoringStrategies,
  AdminListChallenges,
  AdminUpdateChallenge,
} from "@noctf/api/contract/admin_challenge";
import { ActorType } from "@noctf/server-core/types/enums";
import { route } from "@noctf/server-core/util/route";
import type { FastifyInstance } from "fastify";

export async function routes(fastify: FastifyInstance) {
  const { challengeService, scoreService } = fastify.container.cradle;

  route(
    fastify,
    AdminGetScoringStrategies,
    {
      auth: {
        require: true,
        policy: ["admin.challenge.get"],
      },
    },
    async () => {
      return {
        data: await scoreService.getStrategies(),
      };
    },
  );

  route(
    fastify,
    AdminListChallenges,
    {
      auth: {
        require: true,
        policy: ["admin.challenge.get"],
      },
    },
    async (request) => {
      return {
        data: await challengeService.list(request.query),
      };
    },
  );

  route(
    fastify,
    AdminCreateChallenge,
    {
      auth: {
        require: true,
        policy: ["admin.challenge.create"],
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

  route(
    fastify,
    AdminGetChallenge,
    {
      auth: {
        require: true,
        policy: ["admin.challenge.get"],
      },
    },
    async (request) => {
      return {
        data: await challengeService.get(request.params.id, false),
      };
    },
  );

  route(
    fastify,
    AdminUpdateChallenge,
    {
      auth: {
        require: true,
        policy: ["admin.challenge.update"],
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

  route(
    fastify,
    AdminDeleteChallenge,
    {
      auth: {
        require: true,
        policy: ["admin.challenge.delete"],
      },
    },
    async (request) => {
      await challengeService.delete(request.params.id);
      return {};
    },
  );

  route(
    fastify,
    AdminGetChallengePrivateMetadataSchema,
    {
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
    () => {
      return {
        data: challengeService.getPrivateMetadataSchema(),
      };
    },
  );
}
