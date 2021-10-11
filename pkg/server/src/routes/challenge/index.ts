import { FastifyInstance, FastifySchema } from 'fastify';
import { ChallengeSolveAttemptRequest } from '../../schemas/challenge/requests';
import {
  ChallengeChallengeResponse, ChallengeChallengeResponseType, ChallengeHintListResponse, ChallengeHintListResponseType, ChallengeHintResponse, ChallengeHintResponseType, ChallengeListResponse, ChallengeListResponseType, ChallengePlayerSolveListResponse, ChallengePlayerSolveListResponseType, ChallengeSolveAttemptResponse, ChallengeSolveAttemptResponseType,
} from '../../schemas/challenge/responses';

export default async function register(fastify: FastifyInstance) {
  const BASE_SCHEMA: FastifySchema = { tags: ['challenge'] };

  // List challenges
  fastify.get<{ Reply: ChallengeListResponseType }>(
    '/',
    { schema: { ...BASE_SCHEMA, response: { default: ChallengeListResponse } } },
    async (request, reply) => {

    },
  );

  // Get particular challenge
  fastify.get<{ Reply: ChallengeChallengeResponseType }>(
    '/:challengeid',
    { schema: { ...BASE_SCHEMA, response: { default: ChallengeChallengeResponse } } },
    async (request, reply) => {

    },
  );

  // Get challenge solves
  fastify.get<{ Reply: ChallengePlayerSolveListResponseType }>(
    '/:challengeid/solves',
    { schema: { ...BASE_SCHEMA, response: { default: ChallengePlayerSolveListResponse } } },
    async (request, reply) => {

    },
  );

  // List challenge hints
  fastify.get<{ Reply: ChallengeHintListResponseType }>(
    '/:challengeid/hints',
    { schema: { ...BASE_SCHEMA, response: { default: ChallengeHintListResponse } } },
    async (request, reply) => {

    },
  );

  // Get challenge particular hint
  fastify.get<{ Reply: ChallengeHintResponseType }>(
    '/:challengeid/hints/:hintid',
    { schema: { ...BASE_SCHEMA, response: { default: ChallengeHintResponse } } },
    async (request, reply) => {

    },
  );

  // Unlock hint
  fastify.post<{ Reply: ChallengeHintResponseType }>(
    '/:challengeid/hints/:hintid/unlock',
    { schema: { ...BASE_SCHEMA, response: { default: ChallengeHintResponse } } },
    async (request, reply) => {

    },
  );

  // User solve attempt
  fastify.post<{ Reply: ChallengeSolveAttemptResponseType }>(
    '/:challengeid/solves',
    { schema: { ...BASE_SCHEMA, body: ChallengeSolveAttemptRequest, response: { default: ChallengeSolveAttemptResponse } } },
    async (request, reply) => {

    },
  );
}
