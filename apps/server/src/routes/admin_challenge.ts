import {
  AdminCreateChallenge,
  AdminDeleteChallenge,
  AdminGetChallenge,
  AdminGetChallengePrivateMetadataSchema,
  AdminGetScoringStrategies,
  AdminListChallenges,
  AdminListChallengeWeights,
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
import type { FastifyInstance, FastifyRequest } from "fastify";
import {
  PayloadDigestPreParsingHook,
  PayloadDigestPreValidationHook,
} from "../hooks/payload.ts";
import { GetUtils } from "./_util.ts";
import { OffsetPaginate } from "@noctf/server-core/util/paginator";

const MAX_PAGE_SIZE_WEIGHTS = 2000;

export async function routes(fastify: FastifyInstance) {
  const { challengeService, scoreService, submissionService } =
    fastify.container.cradle;

  const { isCompetitionActive } = GetUtils(fastify.container.cradle);

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

  async function validateWeightKey(
    request: FastifyRequest<{ Params: { id: number } }>,
    validateContent?: boolean,
  ) {
    const challenge = await challengeService.get(request.params.id);
    const requiredFields = ["@method", "@path", "@authority"];
    if (validateContent) requiredFields.push("content-digest");
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
        requiredFields,
      },
      {
        method: request.method,
        url: new URL(request.url, `${request.protocol}://${request.host}`),
        headers: request.headers,
      },
    );
    if (!verified) throw new UnauthorizedError("Invalid signature");
    return challenge;
  }

  route(
    fastify,
    AdminListChallengeWeights,
    {
      auth: {
        // This endpoint uses HMAC-based auth specific to each challenge
        require: false,
      },
    },
    async (request) => {
      await validateWeightKey(request);
      const query = {
        challenge_id: [request.params.id],
        team_id: request.query.team_id,
      };
      const [result, total] = await Promise.all([
        OffsetPaginate(
          query,
          request.query,
          (q, l) => submissionService.listWeights(q, l),
          {
            max_page_size: MAX_PAGE_SIZE_WEIGHTS,
          },
        ),
        submissionService.getCount(query),
      ]);
      return { data: { ...result, total } };
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
        if (request.body.items.length > MAX_PAGE_SIZE_WEIGHTS) {
          throw new BadRequestError(
            "TooManyItems",
            `number of items in request should be less than ${MAX_PAGE_SIZE_WEIGHTS}`,
          );
        }
        await validateWeightKey(request, true);

        if (!isCompetitionActive()) {
          throw new ApplicationError(
            410,
            "CompetitionNotActive",
            "The competition is currently not active",
          );
        }

        const entries = await submissionService.upsertWeightsForChallenge(
          request.params.id,
          request.body.items,
          "api:weight_update",
        );
        return {
          data: {
            entries,
            page_size: 1000,
            total: entries.length,
          },
        };
      },
    },
  );
}
