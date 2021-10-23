import { FastifyInstance, FastifySchema } from 'fastify';
import { ChallengeSolveAttemptRequest } from '../../schemas/challenge/requests';
import {
  ChallengeChallengeResponse, ChallengeChallengeResponseType, ChallengeHintListResponse, ChallengeHintListResponseType, ChallengeHintResponse, ChallengeHintResponseType, ChallengeListResponse, ChallengeListResponseType, ChallengePlayerSolveListResponse, ChallengePlayerSolveListResponseType, ChallengeSolveAttemptResponse, ChallengeSolveAttemptResponseType,
} from '../../schemas/challenge/responses';
import PlayerChallengeDAO from '../../models/PlayerChallenge';

export default async function register(fastify: FastifyInstance) {
  const BASE_SCHEMA: FastifySchema = { tags: ['challenge'] };

  // List challenges
  fastify.get<{ Reply: ChallengeListResponseType }>(
    '/',
    { schema: { ...BASE_SCHEMA, response: { default: ChallengeListResponse } } },
    async (request, reply) => {
      reply.send({
        challenges: await PlayerChallengeDAO.listVisibleChallenges();
      });
    },
  );

  // Get particular challenge
  fastify.get<{ Reply: ChallengeChallengeResponseType }>(
    '/:challengeid',
    { schema: { ...BASE_SCHEMA, response: { default: ChallengeChallengeResponse } } },
    async (request, reply) => {
      const challenge = await PlayerChallengeDAO.getChallengeById(0);
      if(challenge === null) {
        reply.status(404);
      } else {
        reply.send(challenge);
      }
    },
  );

  // Get challenge solves
  fastify.get<{ Reply: ChallengePlayerSolveListResponseType }>(
    '/:challengeid/solves',
    { schema: { ...BASE_SCHEMA, response: { default: ChallengePlayerSolveListResponse } } },
    async (request, reply) => {
      const solves = await PlayerChallengeDAO.getChallengeSolves(0);
      reply.send(solves);
    },
  );

  // List challenge hints
  fastify.get<{ Reply: ChallengeHintListResponseType }>(
    '/:challengeid/hints',
    { schema: { ...BASE_SCHEMA, response: { default: ChallengeHintListResponse } } },
    async (request, reply) => {
      const hints = await PlayerChallengeDAO.listChallengeHints(0, 0);
    },
  );

  // Get challenge particular hint
  fastify.get<{ Reply: ChallengeHintResponseType }>(
    '/:challengeid/hints/:hintid',
    { schema: { ...BASE_SCHEMA, response: { default: ChallengeHintResponse } } },
    async (request, reply) => {
      const hint = await PlayerChallengeDAO.getHint(0, 0);
    },
  );

  // Unlock hint
  fastify.post<{ Reply: ChallengeHintResponseType }>(
    '/:challengeid/hints/:hintid/unlock',
    { schema: { ...BASE_SCHEMA, response: { default: ChallengeHintResponse } } },
    async (request, reply) => {
      await PlayerChallengeDAO.unlockHint(0, 0)
    },
  );

  // User solve attempt
  fastify.post<{ Reply: ChallengeSolveAttemptResponseType }>(
    '/:challengeid/solves',
    { schema: { ...BASE_SCHEMA, body: ChallengeSolveAttemptRequest, response: { default: ChallengeSolveAttemptResponse } } },
    async (request, reply) => {
      const res = await PlayerChallengeDAO.makeAndCheckSubmission(0, 0, '');
      reply.send({
        success: res
      })
    },
  );
}
