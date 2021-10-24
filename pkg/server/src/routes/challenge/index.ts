import { FastifyInstance, FastifySchema } from 'fastify';
import {
  ChallengeChallengeIdPath, ChallengeChallengePathType,
  ChallengeHintIdPath, ChallengeHintIdPathType,
  ChallengeSolveAttemptRequest, ChallengeSolveAttemptRequestType,
} from '@noctf/schema/challenge/requests';
import {
  ChallengeChallengeResponse, ChallengeChallengeResponseType,
  ChallengeHintListResponse, ChallengeHintListResponseType,
  ChallengeHintResponse, ChallengeHintResponseType,
  ChallengeListResponse, ChallengeListResponseType,
  ChallengePlayerSolveListResponse, ChallengePlayerSolveListResponseType,
  ChallengeSolveAttemptResponse, ChallengeSolveAttemptResponseType,
} from '@noctf/schema/challenge/responses';
import PlayerChallengeDAO from '../../models/PlayerChallenge';
import { NoCTFNotFoundException } from '../../util/exceptions';
import { appUserKeyGenerator } from '../../util/ratelimit';

export default async function register(fastify: FastifyInstance) {
  const BASE_SCHEMA: FastifySchema = { tags: ['challenge'] };

  // List challenges
  fastify.get<{ Reply: ChallengeListResponseType }>(
    '/',
    {
      schema: { ...BASE_SCHEMA, response: { default: ChallengeListResponse } },
      config: {
        permission: 'challenge.challenge.read',
      },
    },
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
      config: {
        permission: 'challenge.challenge.read',
      },
    },
    async (request, reply) => {
      const challenge = await PlayerChallengeDAO.getChallengeById(request.params.challengeId);
      if (challenge === null) {
        throw new NoCTFNotFoundException('challenge', request.params.challengeId);
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
      config: {
        permission: 'challenge.solves.read',
      },
    },
    async (request, reply) => {
      const challenge = await PlayerChallengeDAO.getChallengeById(request.params.challengeId);
      if (challenge === null) {
        throw new NoCTFNotFoundException('challenge', request.params.challengeId);
      }

      // TODO: filter out hidden teams
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
      config: {
        permission: 'challenge.hints.read',
      },
    },
    async (request, reply) => {
      const challenge = await PlayerChallengeDAO.getChallengeById(request.params.challengeId);
      if (challenge === null) {
        throw new NoCTFNotFoundException('challenge', request.params.challengeId);
      }

      const hints = await PlayerChallengeDAO.listChallengeHints(request.params.challengeId);
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
      config: {
        permission: 'challenge.hints.read',
      },
    },
    async (request, reply) => {
      const hint = await PlayerChallengeDAO.getHint(request.params.hintId);
      if (!hint) {
        throw new NoCTFNotFoundException('hint', request.params.hintId);
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
    '/:challengeId/solve',
    {
      schema: {
        ...BASE_SCHEMA,
        params: { default: ChallengeChallengeIdPath },
        body: ChallengeSolveAttemptRequest,
        response: { default: ChallengeSolveAttemptResponse },
      },
      config: {
        permission: 'submissions.write',
        rateLimit: {
          max: 16, // TODO: figure this out from data
          timeWindow: '1 minute',
          keyGenerator: appUserKeyGenerator,
        },
      },
    },
    async (request, reply) => {
      // TODO: can inline this during insert if performance is an issue
      const challenge = await PlayerChallengeDAO.getChallengeById(request.params.challengeId);
      if (challenge === null) {
        throw new NoCTFNotFoundException('challenge', request.params.challengeId);
      }

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
