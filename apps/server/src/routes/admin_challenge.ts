import { GetChallengeParams } from "@noctf/api/params";
import {
  AdminCreateChallengeRequest,
  AdminUpdateChallengeRequest,
} from "@noctf/api/requests";
import {
  AdminGetChallengeResponse,
  AdminUpdateChallengeResponse,
  AnyResponse,
} from "@noctf/api/responses";
import { ActorType } from "@noctf/server-core/types/enums";
import type { FastifyInstance } from "fastify";

export async function routes(fastify: FastifyInstance) {
  const { challengeService } = fastify.container.cradle;

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
    "/admin/challenges/private_metadata",
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
