import { FastifyInstance, FastifySchema } from 'fastify';
import {
  ChallengeChallengeIdPath, ChallengeChallengePathType,
  ChallengeHintIdPath, ChallengeHintIdPathType,
  ChallengeSolveAttemptRequest, ChallengeSolveAttemptRequestType,
} from '../../schemas/challenge/requests';
import {
  ChallengeChallengeResponse, ChallengeChallengeResponseType,
  ChallengeHintListResponse, ChallengeHintListResponseType,
  ChallengeHintResponse, ChallengeHintResponseType,
  ChallengeListResponse, ChallengeListResponseType,
  ChallengePlayerSolveListResponse, ChallengePlayerSolveListResponseType,
  ChallengeSolveAttemptResponse, ChallengeSolveAttemptResponseType,
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
        challenges: await PlayerChallengeDAO.listVisibleChallenges(),
      });
    },
  );

  // Get particular challenge
  fastify.get<{ Params: ChallengeChallengePathType, Reply: ChallengeChallengeResponseType }>(
    '/:challengeId',
    {
      schema: {
        ...BASE_SCHEMA,
        params: { default: ChallengeChallengeIdPath },
        response: { default: ChallengeChallengeResponse },
      },
    },
    async (request, reply) => {
      const challenge = await PlayerChallengeDAO.getChallengeById(request.params.challengeId);
      if (challenge === null) {
        reply.status(404);
      } else {
        reply.send(challenge);
      }
    },
  );

  // Get challenge solves
  fastify.get<{ Params: ChallengeChallengePathType, Reply: ChallengePlayerSolveListResponseType }>(
    '/:challengeId/solves',
    {
      schema: {
        ...BASE_SCHEMA,
        params: { default: ChallengeChallengeIdPath },
        response: { default: ChallengePlayerSolveListResponse },
      },
    },
    async (request, reply) => {
      const solves = await PlayerChallengeDAO.getChallengeSolves(request.params.challengeId);
      reply.send({
        solves,
      });
    },
  );

  // List challenge hints
  fastify.get<{ Params: ChallengeChallengePathType, Reply: ChallengeHintListResponseType }>(
    '/:challengeId/hints',
    {
      schema: {
        ...BASE_SCHEMA,
        params: { default: ChallengeChallengeIdPath },
        response: { default: ChallengeHintListResponse },
      },
    },
    async (request, reply) => {
      const hints = await PlayerChallengeDAO.listChallengeHints(
        request.auth.uid,
        request.params.challengeId,
      );
      reply.send({
        hints,
      });
    },
  );

  // Get challenge particular hint
  fastify.get<{ Params: ChallengeHintIdPathType, Reply: ChallengeHintResponseType }>(
    '/hints/:hintId',
    {
      schema: {
        ...BASE_SCHEMA,
        params: { default: ChallengeHintIdPath },
        response: { default: ChallengeHintResponse },
      },
    },
    async (request, reply) => {
      const hint = await PlayerChallengeDAO.getHint(request.auth.uid, request.params.hintId);
      if (!hint) {
        reply.status(404);
      } else {
        reply.send(hint);
      }
    },
  );

  // User solve attempt
  fastify.post<{
    Params: ChallengeChallengePathType,
    Body: ChallengeSolveAttemptRequestType,
    Reply: ChallengeSolveAttemptResponseType
  }>(
    '/:challengeId/solves',
    {
      schema: {
        ...BASE_SCHEMA,
        params: { default: ChallengeChallengeIdPath },
        body: ChallengeSolveAttemptRequest,
        response: { default: ChallengeSolveAttemptResponse },
      },
    },
    async (request, reply) => {
      const success = await PlayerChallengeDAO.makeAndCheckSubmission(
        request.auth.uid,
        request.params.challengeId,
        request.body.flag,
      );
      reply.send({
        success,
      });
    },
  );
}
