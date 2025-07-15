import { Static, Type } from "@sinclair/typebox";
import { ObjectUpdateType, SubmissionStatus } from "./enums.ts";
import { Announcement, EmailAddressOrUserId, TypeDate } from "./datatypes.ts";

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
    comments: Type.String(),
  },
  { $id: "events.submission.update" },
);
export type SubmissionUpdateEvent = Static<typeof SubmissionUpdateEvent>;

export const AnnouncementUpdateEvent = Type.Composite(
  [
    Announcement,
    Type.Object({
      state: ObjectUpdateType,
      delivery_channels: Type.Array(Type.String(), { uniqueItems: true }),
    }),
  ],
  { $id: "events.announcement.update" },
);
export type AnnouncementUpdateEvent = Static<typeof AnnouncementUpdateEvent>;

export const ChallengeUpdateEvent = Type.Object(
  {
    id: Type.Integer(),
    slug: Type.String(),
    hidden: Type.Optional(Type.Boolean()),
    version: Type.Integer(),
    type: ObjectUpdateType,
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

export const PolicyUpdateEvent = Type.Object(
  {
    name: Type.String(),
    id: Type.Integer(),
    version: Type.Integer(),
    updated_at: TypeDate,
    type: ObjectUpdateType,
  },
  { $id: "events.policy.update" },
);
export type PolicyUpdateEvent = Static<typeof PolicyUpdateEvent>;

export const ScoreboardTriggerEvent = Type.Object(
  {
    recompute_graph: Type.Optional(Type.Boolean()),
  },
  { $id: "events.scoreboard.trigger" },
);
export type ScoreboardTriggerEvent = Static<typeof ScoreboardTriggerEvent>;

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

export const NotificationQueueWebhookEvent = Type.Object(
  {
    url: Type.String({ format: "uri" }),
    payload: Type.Object({}, { additionalProperties: true }),
  },
  { $id: "queue.notification.webhook" },
);
export type NotificationQueueWebhookEvent = Static<
  typeof NotificationQueueWebhookEvent
>;
