import type { Static } from "@sinclair/typebox";
import { Type } from "@sinclair/typebox";
import {
  CaptchaValidationString,
  Challenge,
  Team,
  TypeDate,
  User,
} from "./datatypes.ts";
import { SubmissionStatus } from "./enums.ts";

const NoInvalidWhitespace =
  "^(?! )[^\\t\\n\\r\\f\\v\\u00A0\\u1680\\u2000\\u2001\\u2002\\u2003\\u2004\\u2005\\u2006\\u2007\\u2008\\u2009\\u200A\\u200B\\u200C\\u200D\\u200E\\u200F\\u2028\\u2029\\u202F\\u205F\\u2060\\u3000\\uFEFF]+(?<! )$";

export const UpdateUserRequest = Type.Composite(
  [
    Type.Pick(User, ["bio"]),
    Type.Object({
      name: Type.Optional(
        Type.String({
          minLength: 1,
          maxLength: 64,
          pattern: NoInvalidWhitespace,
        }),
      ),
    }),
  ],
  {
    additionalProperties: false,
  },
);
export type UpdateUserRequest = Static<typeof UpdateUserRequest>;

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
    verify: Type.Optional(Type.Boolean()),
  },
  { additionalProperties: false },
);
export type InitAuthEmailRequest = Static<typeof InitAuthEmailRequest>;

export const CreateResetAuthEmailRequest = Type.Object(
  {
    email: Type.String({ format: "email" }),
  },
  { additionalProperties: false },
);
export type CreateResetAuthEmailRequest = Static<
  typeof CreateResetAuthEmailRequest
>;

export const ApplyResetAuthEmailRequest = Type.Object(
  {
    token: Type.String(),
    password: Type.String({ minLength: 8, maxLength: 256 }),
  },
  { additionalProperties: false },
);
export type ApplyResetAuthEmailRequest = Static<
  typeof ApplyResetAuthEmailRequest
>;

export const FinishAuthEmailRequest = Type.Object(
  {
    email: Type.String({ format: "email" }),
    password: Type.String(),
  },
  { additionalProperties: false },
);
export type FinishAuthEmailRequest = Static<typeof FinishAuthEmailRequest>;

export const ChangeAuthEmailRequest = Type.Object(
  {
    email: Type.Optional(Type.String({ format: "email" })),
    password: Type.String(),
    newPassword: Type.Optional(Type.String({ minLength: 8, maxLength: 256 })),
  },
  { additionalProperties: false },
);
export type ChangeAuthEmailRequest = Static<typeof ChangeAuthEmailRequest>;

export const AssociateRequest = Type.Object(
  {
    token: Type.String(),
  },
  { additionalProperties: false },
);
export type AssociateRequest = Static<typeof AssociateRequest>;

export const RegisterAuthRequest = Type.Object(
  {
    token: Type.String(),
    name: Type.String({
      minLength: 1,
      maxLength: 64,
      pattern: NoInvalidWhitespace,
    }),
    email: Type.Optional(Type.String({ format: "email" })),
    password: Type.Optional(Type.String({ minLength: 8, maxLength: 256 })),
  },
  { additionalProperties: false },
);
export type RegisterAuthRequest = Static<typeof RegisterAuthRequest>;

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
    created_at: Type.Optional(
      Type.Tuple([
        Type.Union([TypeDate, Type.Null()]),
        Type.Union([TypeDate, Type.Null()]),
      ]),
    ),
    actor: Type.Optional(Type.Array(Type.String())),
    entities: Type.Optional(Type.Array(Type.String())),
    operation: Type.Optional(Type.Array(Type.String())),
    offset: Type.Optional(Type.Number()),
    limit: Type.Optional(Type.Number()),
  },
  { additionalProperties: false },
);
export type QueryAuditLogRequest = Static<typeof QueryAuditLogRequest>;

export const AdminQuerySubmissionsRequest = Type.Object(
  {
    page: Type.Optional(Type.Integer({ minimum: 1 })),
    page_size: Type.Optional(Type.Integer()),
    created_at: Type.Optional(
      Type.Tuple([
        Type.Union([TypeDate, Type.Null()]),
        Type.Union([TypeDate, Type.Null()]),
      ]),
    ),
    user_id: Type.Optional(Type.Array(Type.Number())),
    team_id: Type.Optional(Type.Array(Type.Number())),
    challenge_id: Type.Optional(Type.Array(Type.Number())),
    status: Type.Optional(Type.Array(SubmissionStatus)),
    hidden: Type.Optional(Type.Boolean()),
    data: Type.Optional(Type.String()),
  },
  { additionalProperties: false },
);
export type AdminQuerySubmissionsRequest = Static<
  typeof AdminQuerySubmissionsRequest
>;

export const AdminUpdateSubmissionsRequest = Type.Object(
  {
    ids: Type.Array(Type.Number(), { minItems: 1 }),
    status: Type.Optional(SubmissionStatus),
    hidden: Type.Optional(Type.Boolean()),
    value: Type.Optional(Type.Union([Type.Null(), Type.Number()])),
    comments: Type.Optional(Type.String({ maxLength: 512 })),
  },
  { additionalProperties: false },
);
export type AdminUpdateSubmissionsRequest = Static<
  typeof AdminUpdateSubmissionsRequest
>;

export const AdminCreateSubmissionRequest = Type.Object(
  {
    status: SubmissionStatus,
    hidden: Type.Boolean(),
    team_id: Type.Number(),
    challenge_id: Type.Number(),
    comments: Type.Optional(Type.String({ maxLength: 512 })),
    data: Type.String(),
  },
  { additionalProperties: false },
);
export type AdminCreateSubmissionRequest = Static<
  typeof AdminCreateSubmissionRequest
>;

export const CreateTeamRequest = Type.Composite(
  [
    Type.Pick(Team, ["division_id", "tag_ids"]),
    Type.Object({
      name: Type.String({
        minLength: 1,
        maxLength: 64,
        pattern: NoInvalidWhitespace,
      }),
      division_password: Type.Optional(
        Type.String({
          minLength: 1,
          maxLength: 64,
        }),
      ),
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
    Type.Pick(Team, ["bio", "country", "tag_ids"]),
    Type.Object({
      name: Type.String({
        minLength: 1,
        maxLength: 64,
        pattern: NoInvalidWhitespace,
      }),
    }),
    Type.Object({
      join_code: Type.Optional(Type.Enum(UpdateTeamJoinCodeAction)),
    }),
  ],
  { additionalProperties: false },
);
export type UpdateTeamRequest = Static<typeof UpdateTeamRequest>;

export const AdminUpdateTeamRequest = Type.Composite(
  [
    Type.Pick(Team, ["bio", "country", "tag_ids", "division_id", "flags"]),
    Type.Object({
      name: Type.String({
        minLength: 1,
        maxLength: 64,
        pattern: NoInvalidWhitespace,
      }),
    }),
    Type.Object({
      join_code: Type.Optional(Type.Enum(UpdateTeamJoinCodeAction)),
    }),
  ],
  { additionalProperties: false },
);
export type AdminUpdateTeamRequest = Static<typeof AdminUpdateTeamRequest>;

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
    data: Type.String({ maxLength: 512 }),
  },
  { additionalProperties: false },
);
export type SolveChallengeRequest = Static<typeof SolveChallengeRequest>;

export const QueryTeamsRequest = Type.Object(
  {
    division_id: Type.Optional(Type.Integer()),
    page: Type.Optional(Type.Integer({ minimum: 1 })),
    page_size: Type.Optional(Type.Integer()),
    name_prefix: Type.Optional(Type.String({ maxLength: 64 })),
    ids: Type.Optional(Type.Array(Type.Integer(), { maxItems: 50 })),
  },
  { additionalProperties: false },
);
export type QueryTeamsRequest = Static<typeof QueryTeamsRequest>;

export const AdminQueryTeamsRequest = Type.Composite([
  QueryTeamsRequest,
  Type.Object({
    flags: Type.Optional(
      Type.Array(Type.String({ minLength: 1, maxLength: 64 }), {
        maxItems: 50,
      }),
    ),
  }),
]);
export type AdminQueryTeamsRequest = Static<typeof AdminQueryTeamsRequest>;

export const QueryUsersRequest = Type.Object(
  {
    page: Type.Optional(Type.Integer({ minimum: 1 })),
    page_size: Type.Optional(Type.Integer()),
    name_prefix: Type.Optional(Type.String({ maxLength: 64 })),
    ids: Type.Optional(Type.Array(Type.Integer(), { maxItems: 50 })),
  },
  { additionalProperties: false },
);
export type QueryUsersRequest = Static<typeof QueryUsersRequest>;

export const AdminQueryUsersRequest = Type.Composite([
  QueryUsersRequest,
  Type.Object({
    flags: Type.Optional(
      Type.Array(Type.String({ minLength: 1, maxLength: 64 }), {
        maxItems: 50,
      }),
    ),
  }),
]);
export type AdminQueryUsersRequest = Static<typeof AdminQueryUsersRequest>;

export const OAuthTokenRequest = Type.Object({
  grant_type: Type.String(),
  response_type: Type.Optional(Type.String()),
  code: Type.String(),
  redirect_uri: Type.String(),
});
export type OAuthTokenRequest = Static<typeof OAuthTokenRequest>;

export const OAuthAuthorizeInternalRequest = Type.Object({
  client_id: Type.String(),
  redirect_uri: Type.String(),
  scope: Type.Array(Type.String({ pattern: "^[a-z0-9-_/\\.]{1,256}$" }), {
    minItems: 1,
    maxItems: 64,
    uniqueItems: true,
  }),
  state: Type.String({ minLength: 1 }),
  response_type: Type.Array(Type.String({ pattern: "^[a-z0-9-_]{1,32}$" }), {
    minItems: 1,
    maxItems: 32,
    uniqueItems: true,
  }),
});
export type OAuthAuthorizeInternalRequest = Static<
  typeof OAuthAuthorizeInternalRequest
>;
