import {
  AdminCreateChallenge,
  AdminDeleteChallenge,
  AdminGetChallenge,
  AdminGetChallengePrivateMetadataSchema,
  AdminGetScoringStrategies,
  AdminListChallenges,
  AdminUpdateChallenge,
  AdminUpdateChallengeWeights,
} from "@noctf/api/contract/admin_challenge";
import {
  ApplicationError,
  BadRequestError,
  UnauthorizedError,
} from "@noctf/server-core/errors";
import { ActorType } from "@noctf/server-core/types/enums";
import { route } from "@noctf/server-core/util/route";
import { createVerifier, httpbis } from "http-message-signatures";
import type { FastifyInstance } from "fastify";
import {
  PayloadDigestPreParsingHook,
  PayloadDigestPreValidationHook,
} from "../hooks/payload.ts";
import { verify } from "crypto";

export async function routes(fastify: FastifyInstance) {
  const { challengeService, scoreService, submissionService } =
    fastify.container.cradle;

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

  route(
    fastify,
    AdminUpdateChallengeWeights,
    {
      auth: {
        // This endpoint uses HMAC-based auth specific to each challenge
        require: false,
      },
    },
    {
      preParsing: PayloadDigestPreParsingHook,
      preValidation: PayloadDigestPreValidationHook,
      handler: async (request) => {
        if (!request.digests) {
          throw new UnauthorizedError("No content-digest provided");
        }
        const challenge = await challengeService.get(request.params.id);
        const verified = await httpbis.verifyMessage(
          {
            keyLookup: async () => {
              const key = challenge.private_metadata.solve.weight_update_key;
              if (!key) {
                throw new UnauthorizedError("Invalid signature");
              }
              return {
                verify: createVerifier(key, "hmac-sha256"),
              };
            },
            tolerance: 10,
            requiredFields: [
              "@method",
              "@path",
              "@authority",
              "content-digest",
            ],
          },
          {
            method: request.method,
            url: new URL(request.url, `${request.protocol}://${request.host}`),
            headers: request.headers,
          },
        );
        if (!verified) throw new UnauthorizedError("Invalid signature");
        return {
          data: await submissionService.upsertWeights(
            request.params.id,
            request.body.items,
            "api:weight_update",
          ),
        };
      },
    },
  );
}
