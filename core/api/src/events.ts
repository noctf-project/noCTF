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
    created_at: TypeDate,
    updated_at: TypeDate,
    seq: Type.Integer(),
    is_update: Type.Boolean(),
    status: SubmissionStatus,
  },
  { $id: "events.submission.update" },
);
export type SubmissionUpdateEvent = Static<typeof SubmissionUpdateEvent>;

export const ChallengeUpdateEvent = Type.Object(
  {
    id: Type.Integer(),
    slug: Type.String(),
    hidden: Type.Boolean(),
    version: Type.Integer(),
    updated_at: TypeDate,
  },
  { $id: "events.challenge.update" },
);
export type ChallengeUpdateEvent = Static<typeof ChallengeUpdateEvent>;

export const ConfigUpdateEvent = Type.Object(
  {
    namespace: Type.String(),
    version: Type.Integer(),
    updated_at: TypeDate,
  },
  { $id: "events.config.update" },
);
export type ConfigUpdateEvent = Static<typeof ConfigUpdateEvent>;

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

export const NotificationQueueDiscordEvent = Type.Object(
  {
    url: Type.String({ format: "uri" }),
    payload: Type.Object({
      content: Type.String(),
    }),
  },
  { $id: "queue.notification.discord" },
);
export type NotificationQueueDiscordEvent = Static<
  typeof NotificationQueueDiscordEvent
>;

export const NotificationQueueWebhookEvent = Type.Object(
  {
    url: Type.String({ format: "uri" }),
    payload: Type.Object({
      submission_id: Type.Integer(),
      submission_created_at: TypeDate,
      team_id: Type.Integer(),
      team_name: Type.String(),
      user_id: Type.Integer(),
      user_name: Type.String(),
      challenge_id: Type.Integer(),
      challenge_title: Type.String(),
    }),
  },
  { $id: "queue.notification.webhook" },
);
export type NotificationQueueWebhookEvent = Static<
  typeof NotificationQueueWebhookEvent
>;
