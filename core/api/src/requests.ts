import type { Static } from "@sinclair/typebox";
import { Type } from "@sinclair/typebox";
import { Team } from "./datatypes.ts";

export const CaptchaValidationString = Type.Optional(
  Type.String({ maxLength: 1024 }),
);
export type CaptchaValidationString = Static<typeof CaptchaValidationString>;

export const InitAuthOauthRequest = Type.Object({
  name: Type.String(),
});
export type InitAuthOauthRequest = Static<typeof InitAuthOauthRequest>;

export const FinishAuthOauthRequest = Type.Object({
  state: Type.String(),
  code: Type.String(),
  redirect_uri: Type.String(),
});
export type FinishAuthOauthRequest = Static<typeof FinishAuthOauthRequest>;

export const InitAuthEmailRequest = Type.Object({
  email: Type.String({ format: "email" }),
});
export type InitAuthEmailRequest = Static<typeof InitAuthEmailRequest>;

export const FinishAuthEmailRequest = Type.Object({
  email: Type.String({ format: "email" }),
  password: Type.String(),
});
export type FinishAuthEmailRequest = Static<typeof FinishAuthEmailRequest>;

export const RegisterAuthRequest = Type.Object({
  token: Type.String(),
  name: Type.String({ maxLength: 64 }),
  email: Type.Optional(Type.String({ format: "email" })),
  password: Type.Optional(Type.String({ minLength: 8, maxLength: 256 })),
  captcha: CaptchaValidationString,
});
export type RegisterAuthRequest = Static<typeof RegisterAuthRequest>;

export const RegisterAuthTokenRequest = Type.Object({
  token: Type.String(),
});
export type RegisterAuthTokenRequest = Static<typeof RegisterAuthTokenRequest>;

export const UpdateConfigValueRequest = Type.Object({
  value: Type.Any(),
  version: Type.Number(),
});
export type UpdateConfigValueRequest = Static<typeof UpdateConfigValueRequest>;

export const QueryAuditLogRequest = Type.Object({
  start_time: Type.Optional(Type.Number()),
  end_time: Type.Optional(Type.Number()),
  actor: Type.Optional(Type.String()),
  entities: Type.Optional(Type.Array(Type.String())),
  operation: Type.Optional(Type.String()),
  offset: Type.Optional(Type.Number()),
  limit: Type.Optional(Type.Number()),
});
export type QueryAuditLogRequest = Static<typeof QueryAuditLogRequest>;

export const CreateTeamRequest = Type.Composite([
  Type.Pick(Team, ["name"]),
  Type.Object({
    captcha: CaptchaValidationString,
  }),
]);
export type CreateTeamRequest = Static<typeof CreateTeamRequest>;

export const JoinTeamRequest = Type.Composite([
  Type.Pick(Team, ["join_code"]),
  Type.Object({
    captcha: CaptchaValidationString,
  }),
]);
export type JoinTeamRequest = Static<typeof JoinTeamRequest>;

export enum UpdateTeamJoinCodeAction {
  Refresh = "refresh",
  Remove = "remove",
}

export const UpdateTeamRequest = Type.Composite([
  Type.Pick(Team, ["name", "bio"]),
  Type.Object({
    join_code: Type.Optional(Type.Enum(UpdateTeamJoinCodeAction)),
  }),
]);
export type UpdateTeamRequest = Static<typeof UpdateTeamRequest>;
