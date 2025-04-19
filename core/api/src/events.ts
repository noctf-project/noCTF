import { Static, Type } from "@sinclair/typebox";
import { SubmissionStatus } from "./enums.ts";
import { EmailAddressOrUserId, TypeDate } from "./datatypes.ts";

export const SubmissionUpdateEvent = Type.Object(
  {
    id: Type.Integer(),
    team_id: Type.Integer(),
    user_id: Type.Optional(Type.Integer()),
    challenge_id: Type.Integer(),
    hidden: Type.Boolean(),
    updated_at: TypeDate,
    status: SubmissionStatus,
  },
  { $id: "events.submission.update" },
);
export type SubmissionUpdateEvent = Static<typeof SubmissionUpdateEvent>;

export const EmailQueueEvent = Type.Object(
  {
    to: Type.Optional(Type.Array(EmailAddressOrUserId)),
    cc: Type.Optional(Type.Array(EmailAddressOrUserId)),
    bcc: Type.Optional(Type.Array(EmailAddressOrUserId)),
    subject: Type.String(),
    text: Type.String(),
  },
  { $id: "queue.email" },
);
export type EmailQueueEvent = Static<typeof EmailQueueEvent>;
