import { Static, Type } from "@sinclair/typebox";
import { ObjectUpdateType } from "./enums.ts";
import {
  Announcement,
  Challenge,
  EmailAddressOrUserId,
  Solve,
  Team,
  TypeDate,
  User,
} from "./datatypes.ts";

export const ChallengeSolveEvent = Type.Composite(
  [
    Solve,
    Type.Object({
      seq: Type.Integer(),
      division_id: Type.Integer(),
    }),
  ],
  { $id: "events.challenge.solve" },
);
export type ChallengeSolveEvent = Static<typeof ChallengeSolveEvent>;

export const AnnouncementUpdateEvent = Type.Composite(
  [
    Announcement,
    Type.Object({
      type: ObjectUpdateType,
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

export const TeamUpdateEvent = Type.Object(
  {
    id: Type.Integer(),
    division_id: Type.Integer(),
    flags: Type.Array(Type.String()),
    type: ObjectUpdateType,
    updated_at: TypeDate,
  },
  { $id: "events.team.update" },
);
export type TeamUpdateEvent = Static<typeof TeamUpdateEvent>;

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

export const OutgoingSolveWebhookGeneric = Type.Object({
  challenge: Type.Pick(Challenge, ["id", "title"]),
  team: Type.Pick(Team, ["id", "title"]),
  user: Type.Optional(Type.Pick(User, ["id", "name"])),
  event: ChallengeSolveEvent,
});
export type OutgoingSolveWebhookGeneric = Static<
  typeof OutgoingSolveWebhookGeneric
>;
