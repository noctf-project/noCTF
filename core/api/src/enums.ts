import { Static, Type } from "@sinclair/typebox";

export const SubmissionStatus = Type.Enum({
  Queued: "queued",
  Incorrect: "incorrect",
  Correct: "correct",
  Invalid: "invalid",
});
export type SubmissionStatus = Static<typeof SubmissionStatus>;
