import type { Static } from "@sinclair/typebox";
import { Type } from "@sinclair/typebox";
import {
  CaptchaValidationString,
  Challenge,
  Team,
  TypeDate,
} from "./datatypes.ts";

export const InitAuthOauthRequest = Type.Object(
  {
    name: Type.String(),
  },
  { additionalProperties: false },
);
export type InitAuthOauthRequest = Static<typeof InitAuthOauthRequest>;

export const FinishAuthOauthRequest = Type.Object(
  {
    state: Type.String(),
    code: Type.String(),
    redirect_uri: Type.String(),
  },
  { additionalProperties: false },
);
export type FinishAuthOauthRequest = Static<typeof FinishAuthOauthRequest>;

export const InitAuthEmailRequest = Type.Object(
  {
    email: Type.String({ format: "email" }),
  },
  { additionalProperties: false },
);
export type InitAuthEmailRequest = Static<typeof InitAuthEmailRequest>;

export const FinishAuthEmailRequest = Type.Object(
  {
    email: Type.String({ format: "email" }),
    password: Type.String(),
  },
  { additionalProperties: false },
);
export type FinishAuthEmailRequest = Static<typeof FinishAuthEmailRequest>;

export const RegisterAuthRequest = Type.Object(
  {
    token: Type.String(),
    name: Type.String({ maxLength: 64 }),
    email: Type.Optional(Type.String({ format: "email" })),
    password: Type.Optional(Type.String({ minLength: 8, maxLength: 256 })),
    captcha: CaptchaValidationString,
  },
  { additionalProperties: false },
);
export type RegisterAuthRequest = Static<typeof RegisterAuthRequest>;

export const RegisterAuthTokenRequest = Type.Object(
  {
    token: Type.String(),
  },
  { additionalProperties: false },
);
export type RegisterAuthTokenRequest = Static<typeof RegisterAuthTokenRequest>;

export const UpdateConfigValueRequest = Type.Object(
  {
    value: Type.Any(),
    version: Type.Number(),
  },
  { additionalProperties: false },
);
export type UpdateConfigValueRequest = Static<typeof UpdateConfigValueRequest>;

export const QueryAuditLogRequest = Type.Object(
  {
    start_time: Type.Optional(TypeDate),
    end_time: Type.Optional(TypeDate),
    actor: Type.Optional(Type.String()),
    entities: Type.Optional(Type.Array(Type.String())),
    operation: Type.Optional(Type.String()),
    offset: Type.Optional(Type.Number()),
    limit: Type.Optional(Type.Number()),
  },
  { additionalProperties: false },
);
export type QueryAuditLogRequest = Static<typeof QueryAuditLogRequest>;

export const CreateTeamRequest = Type.Composite(
  [
    Type.Pick(Team, ["name", "division_id"]),
    Type.Object({
      captcha: CaptchaValidationString,
    }),
  ],
  { additionalProperties: false },
);
export type CreateTeamRequest = Static<typeof CreateTeamRequest>;

export const JoinTeamRequest = Type.Composite(
  [
    Type.Pick(Team, ["join_code"]),
    Type.Object({
      captcha: CaptchaValidationString,
    }),
  ],
  { additionalProperties: false },
);
export type JoinTeamRequest = Static<typeof JoinTeamRequest>;

export enum UpdateTeamJoinCodeAction {
  Refresh = "refresh",
  Remove = "remove",
}

export const UpdateTeamRequest = Type.Composite(
  [
    Type.Pick(Team, ["name", "bio", "country"]),
    Type.Object({
      join_code: Type.Optional(Type.Enum(UpdateTeamJoinCodeAction)),
    }),
  ],
  { additionalProperties: false },
);
export type UpdateTeamRequest = Static<typeof UpdateTeamRequest>;

export const AdminCreateChallengeRequest = Type.Omit(
  Challenge,
  ["created_at", "updated_at", "id", "version"],
  { additionalProperties: false },
);
export type AdminCreateChallengeRequest = Static<
  typeof AdminCreateChallengeRequest
>;

export const AdminUpdateChallengeRequest = Type.Omit(
  Type.Partial(Challenge),
  ["created_at", "updated_at", "id", "slug"],
  { additionalProperties: false },
);
export type AdminUpdateChallengeRequest = Static<
  typeof AdminUpdateChallengeRequest
>;

export const SolveChallengeRequest = Type.Object(
  {
    data: Type.String(),
  },
  { additionalProperties: false },
);
export type SolveChallengeRequest = Static<typeof SolveChallengeRequest>;
