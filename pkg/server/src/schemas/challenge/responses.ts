import { Static, Type } from '@sinclair/typebox';
import { PaginatedResponse } from '../common';

export const ChallengeChallengeResponse = Type.Object({
  id: Type.Number(),
  category: Type.String(),
  name: Type.String(),
  description: Type.String(),
});
export type ChallengeChallengeResponseType = Static<typeof ChallengeChallengeResponse>;

export const ChallengeListResponse = PaginatedResponse(Type.Object({
  challenges: Type.Array(ChallengeChallengeResponse),
}));
export type ChallengeListResponseType = Static<typeof ChallengeListResponse>;

export const ChallengePlayerSolveListResponse = PaginatedResponse(Type.Object({
  solves: Type.Array(
    Type.Object({
      id: Type.Number(),
      challenge_id: Type.Number(),
      team_id: Type.Number(),
      team_name: Type.String(),
    }),
  )
}));
export type ChallengePlayerSolveListResponseType = Static<typeof ChallengePlayerSolveListResponse>;

export const ChallengeHintResponse = Type.Object({
  id: Type.Number(),
  hint: Type.Optional(Type.String()),
  cost: Type.Number(),
  unlocked: Type.Boolean(),
  released: Type.Number(),
  updated: Type.Number(),
});
export type ChallengeHintResponseType = Static<typeof ChallengeHintResponse>;

export const ChallengeHintListResponse = PaginatedResponse(Type.Object({
  hints: Type.Array(ChallengeHintResponse)
}));
export type ChallengeHintListResponseType = Static<typeof ChallengeHintListResponse>;

export const ChallengeSolveAttemptResponse = Type.Object({
  success: Type.Boolean(),
});
export type ChallengeSolveAttemptResponseType = Static<typeof ChallengeSolveAttemptResponse>;
