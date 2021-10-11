import { Static, Type } from '@sinclair/typebox';

export const ChallengeSolveAttemptRequest = Type.Object({
  flag: Type.String(),
});
export type ChallengeSolveAttemptRequestType = Static<typeof ChallengeSolveAttemptRequest>;
