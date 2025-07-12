import { Static, Type } from "@sinclair/typebox";

export const SubmissionStatus = Type.Enum({
  Queued: "queued",
  Incorrect: "incorrect",
  Correct: "correct",
  Invalid: "invalid",
});
export type SubmissionStatus = Static<typeof SubmissionStatus>;

export const PolicyUpdateType = Type.Enum({
  Create: "create",
  Update: "update",
  Delete: "delete",
});
export type PolicyUpdateType = Static<typeof PolicyUpdateType>;
