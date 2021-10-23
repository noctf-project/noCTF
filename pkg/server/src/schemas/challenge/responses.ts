import { Static, Type } from '@sinclair/typebox';

export const ChallengeChallengeResponse = Type.Object({
  id: Type.Number(),
  name: Type.String(),
  category: Type.String(),
  description: Type.String(),
  attachments: Type.Array(Type.Object({
    name: Type.String(),
    uri: Type.String(),
  })),
  score: Type.Object({
    initial: Type.Number(),
    decay: Type.Number(),
    minimum: Type.Number(),
  }),
  display_at: Type.Number(),
  created_at: Type.Number(),
  updated_at: Type.Number(),
});

export type ChallengeChallengeResponseType = Static<typeof ChallengeChallengeResponse>;

// TODO: PaginatedResponse
export const ChallengeListResponse = (Type.Object({
  challenges: Type.Array(ChallengeChallengeResponse),
}));
export type ChallengeListResponseType = Static<typeof ChallengeListResponse>;

// TODO: PaginatedResponse
export const ChallengePlayerSolveListResponse = (Type.Object({
  solves: Type.Array(
    Type.Object({
      challenge_id: Type.Number(),
      submitter: Type.Number(),
    }),
  ),
}));
export type ChallengePlayerSolveListResponseType = Static<typeof ChallengePlayerSolveListResponse>;

export const ChallengeHintResponse = Type.Object({
  id: Type.Number(),
  hint: Type.Optional(Type.String()),
  released_at: Type.Number(),
  created_at: Type.Number(),
  updated_at: Type.Number(),
});
export type ChallengeHintResponseType = Static<typeof ChallengeHintResponse>;

// TODO: PaginatedResponse
export const ChallengeHintListResponse = (Type.Object({
  hints: Type.Array(ChallengeHintResponse),
}));
export type ChallengeHintListResponseType = Static<typeof ChallengeHintListResponse>;

export const ChallengeSolveAttemptResponse = Type.Object({
  success: Type.Boolean(),
});
export type ChallengeSolveAttemptResponseType = Static<typeof ChallengeSolveAttemptResponse>;
