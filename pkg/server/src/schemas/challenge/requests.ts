import { Static, Type } from '@sinclair/typebox';

export const ChallengeSolveAttemptRequest = Type.Object({
  flag: Type.String(),
});
export type ChallengeSolveAttemptRequestType = Static<typeof ChallengeSolveAttemptRequest>;

export const ChallengeChallengeIdPath = Type.Object({
  challengeId: Type.Number(),
});
export type ChallengeChallengePathType = Static<typeof ChallengeChallengeIdPath>;

export const ChallengeHintIdPath = Type.Object({
  hintId: Type.Number(),
});
export type ChallengeHintIdPathType = Static<typeof ChallengeHintIdPath>;
