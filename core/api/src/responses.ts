import type { Static } from "@sinclair/typebox";
import { Type } from "@sinclair/typebox";
import {
  AuditLogEntry,
  AuthMethod,
  Challenge,
  FileMetadata,
  PublicChallenge,
  PublicChallengeSummary,
  ScoringStrategy,
  ScoreboardEntry,
  TeamSummary,
  Solve,
  Submission,
  Division,
  TeamTag,
  UserSummary,
  UserIdentity,
  Session,
  PolicyDocument,
} from "./datatypes.ts";
import { AuthTokenType } from "./token.ts";
import { SubmissionStatus } from "./enums.ts";
import { CaptchaConfig, SetupConfig } from "./config.ts";

export const BaseResponse = Type.Object({
  error: Type.Optional(Type.String()),
  message: Type.Optional(Type.String()),
});
export type BaseResponse = Static<typeof BaseResponse>;

export const SuccessResponse = Type.Object({
  data: Type.Literal(true),
});
export type SuccessResponse = Static<typeof SuccessResponse>;

export const GetCaptchaConfigResponse = Type.Object({
  data: Type.Optional(
    Type.Pick(CaptchaConfig, ["provider", "public_key", "routes"]),
  ),
});
export type GetCaptchaConfigResponse = Static<typeof GetCaptchaConfigResponse>;

export const ListAuthMethodsResponse = Type.Object({
  data: Type.Array(AuthMethod),
});
export type ListAuthMethodsResponse = Static<typeof ListAuthMethodsResponse>;

export const ListUserIdentitiesResponse = Type.Object({
  data: Type.Array(Type.Pick(UserIdentity, ["provider", "provider_id"])),
});
export type ListUserIdentitiesResponse = Static<
  typeof ListUserIdentitiesResponse
>;

export const InitAuthOauthResponse = Type.Object({
  data: Type.Object({
    url: Type.String(),
    state: Type.String(),
  }),
});
export type InitAuthOauthResponse = Static<typeof InitAuthOauthResponse>;

export const FinishAuthResponse = Type.Object({
  data: Type.Object({
    type: Type.Union([
      AuthTokenType,
      Type.Literal("register"),
      Type.Literal("associate"),
    ]),
    token: Type.String(),
  }),
});
export type FinishAuthResponse = Static<typeof FinishAuthResponse>;

export const AdminGetConfigValueResponse = Type.Object({
  data: Type.Object({
    value: Type.Any(),
    version: Type.Number(),
  }),
});
export type AdminGetConfigValueResponse = Static<
  typeof AdminGetConfigValueResponse
>;

export const QueryAuditLogResponse = Type.Object({
  data: Type.Array(AuditLogEntry),
});
export type QueryAuditLogResponse = Static<typeof QueryAuditLogResponse>;

export const MeTeamResponse = Type.Object({
  data: Type.Composite([Type.Omit(TeamSummary, ["flags", "join_code"])]),
});
export type MeTeamResponse = Static<typeof MeTeamResponse>;

export const CreateTeamResponse = Type.Object({
  data: Type.Composite([Type.Omit(TeamSummary, ["flags"])]),
});
export type CreateTeamResponse = Static<typeof CreateTeamResponse>;

export const ListTeamsResponse = Type.Object({
  data: Type.Object({
    entries: Type.Array(Type.Omit(TeamSummary, ["flags", "join_code"])),
    page_size: Type.Integer(),
    total: Type.Integer(),
  }),
});
export type ListTeamsResponse = Static<typeof ListTeamsResponse>;

export const AdminListTeamsResponse = Type.Object({
  data: Type.Object({
    entries: Type.Array(Type.Omit(TeamSummary, ["join_code"])),
    page_size: Type.Integer(),
    total: Type.Integer(),
  }),
});
export type AdminListTeamsResponse = Static<typeof AdminListTeamsResponse>;

export const ListTeamTagsResponse = Type.Object({
  data: Type.Object({
    tags: Type.Array(Type.Omit(TeamTag, ["created_at"])),
  }),
});
export type ListTeamTagsResponse = Static<typeof ListTeamTagsResponse>;

export const ListUsersResponse = Type.Object({
  data: Type.Object({
    entries: Type.Array(Type.Omit(UserSummary, ["flags", "roles"])),
    page_size: Type.Integer(),
    total: Type.Integer(),
  }),
});
export type ListUsersResponse = Static<typeof ListUsersResponse>;

export const AdminListUsersResponse = Type.Object({
  data: Type.Object({
    entries: Type.Array(
      Type.Composite([
        UserSummary,
        Type.Object({
          derived_roles: Type.Array(Type.String()),
          identities: Type.Array(
            Type.Pick(UserIdentity, ["provider", "provider_id"]),
          ),
        }),
      ]),
    ),
    page_size: Type.Integer(),
    total: Type.Integer(),
  }),
});
export type AdminListUsersResponse = Static<typeof AdminListUsersResponse>;

export const MeUserResponse = Type.Object({
  data: Type.Composite([
    Type.Omit(UserSummary, ["flags"]),
    // TODO: deprecate this, we can get from /team
    Type.Object({
      team_name: Type.Union([Type.String(), Type.Null()]),
      division_id: Type.Union([Type.Integer(), Type.Null()]),
    }),
  ]),
});
export type MeUserResponse = Static<typeof MeUserResponse>;

export const ListChallengesResponse = Type.Object({
  data: Type.Object({
    challenges: Type.Array(
      Type.Composite([
        PublicChallengeSummary,
        Type.Object({
          value: Type.Union([Type.Number(), Type.Null()]),
          solve_count: Type.Number(),
          solved_by_me: Type.Boolean(),
        }),
      ]),
    ),
  }),
});
export type ListChallengesResponse = Static<typeof ListChallengesResponse>;

export const GetChallengeResponse = Type.Object({
  data: PublicChallenge,
});
export type GetChallengeResponse = Static<typeof GetChallengeResponse>;

export const GetChallengeSolvesResponse = Type.Object({
  data: Type.Array(Type.Pick(Solve, ["team_id", "created_at"])),
});
export type GetChallengeSolvesResponse = Static<
  typeof GetChallengeSolvesResponse
>;

export const AdminFileMetadataResponse = Type.Object({
  data: FileMetadata,
});
export type AdminFileMetadataResponse = Static<
  typeof AdminFileMetadataResponse
>;

export const AdminGetChallengeResponse = Type.Object({
  data: Challenge,
});
export type AdminGetChallengeResponse = Static<
  typeof AdminGetChallengeResponse
>;

export const AdminListChallengesResponse = Type.Object({
  data: Type.Array(
    Type.Pick(Challenge, [
      "id",
      "slug",
      "title",
      "tags",
      "hidden",
      "visible_at",
      "created_at",
      "updated_at",
    ]),
  ),
});
export type AdminListChallengesResponse = Static<
  typeof AdminListChallengesResponse
>;

export const AdminUpdateChallengeResponse = Type.Object({
  data: Type.Object({
    version: Type.Number(),
  }),
});
export type AdminUpdateChallengeResponse = Static<
  typeof AdminUpdateChallengeResponse
>;

export const AnyResponse = Type.Object(
  {
    data: Type.Any(),
  },
  { additionalProperties: false },
);
export type AnyResponse = Static<typeof AnyResponse>;

export const AdminGetConfigSchemaResponse = Type.Object(
  {
    data: Type.Array(
      Type.Object({
        namespace: Type.String(),
        schema: Type.Any(),
      }),
    ),
  },
  { additionalProperties: false },
);
export type AdminGetConfigSchemaResponse = Static<
  typeof AdminGetConfigSchemaResponse
>;

export const SolveChallengeResponse = Type.Object(
  {
    data: SubmissionStatus,
  },
  { additionalProperties: false },
);
export type SolveChallengeResponse = Static<typeof SolveChallengeResponse>;

export const AdminGetScoringStrategiesResponse = Type.Object(
  { data: Type.Record(Type.String(), ScoringStrategy) },
  { additionalProperties: false },
);
export type AdminGetScoringStrategiesResponse = Static<
  typeof AdminGetScoringStrategiesResponse
>;

export const ScoreboardResponse = Type.Object({
  data: Type.Object({
    scores: Type.Array(Type.Omit(ScoreboardEntry, ["updated_at"])),
    page_size: Type.Integer(),
    total: Type.Integer(),
  }),
});
export type ScoreboardResponse = Static<typeof ScoreboardResponse>;

export const UpdateTeamResponse = Type.Object({
  data: Type.Object({
    join_code: Type.Optional(Type.String()),
  }),
});
export type UpdateTeamResponse = Static<typeof UpdateTeamResponse>;

export const ScoreboardGraphsResponse = Type.Object({
  data: Type.Array(
    Type.Object({
      team_id: Type.Number(),
      graph: Type.Array(Type.Tuple([Type.Number(), Type.Number()])),
    }),
  ),
});
export type ScoreboardGraphsResponse = Static<typeof ScoreboardGraphsResponse>;

export const ScoreboardTeamResponse = Type.Object({
  data: Type.Composite([
    ScoreboardEntry,
    Type.Object({
      graph: Type.Array(Type.Tuple([Type.Number(), Type.Number()])),
    }),
  ]),
});
export type ScoreboardTeamResponse = Static<typeof ScoreboardTeamResponse>;

export const ScoreboardSolvesResponse = Type.Object({
  data: Type.Array(Solve),
});
export type ScoreboardSolvesResponse = Static<typeof ScoreboardSolvesResponse>;

export const AdminQuerySubmissionsResponse = Type.Object({
  data: Type.Object({
    entries: Type.Array(Submission),
    page_size: Type.Integer(),
    total: Type.Integer(),
  }),
});
export type AdminQuerySubmissionsResponse = Static<
  typeof AdminQuerySubmissionsResponse
>;

export const AdminUpdateSubmissionsResponse = Type.Object({
  data: Type.Array(Type.Number()),
});
export type AdminUpdateSubmissionsResponse = Static<
  typeof AdminUpdateSubmissionsResponse
>;

export const ListDivisionsResponse = Type.Object({
  data: Type.Array(
    Type.Composite(
      [
        Type.Omit(Division, ["password", "is_visible"]),
        Type.Object({
          is_password: Type.Boolean(),
        }),
      ],
      { additionalProperties: false },
    ),
  ),
});
export type ListDivisionsResponse = Static<typeof ListDivisionsResponse>;

export const GetSiteConfigResponse = Type.Object({
  data: SetupConfig,
});
export type GetSiteConfigResponse = Static<typeof GetSiteConfigResponse>;

export const OAuthAuthorizeInternalResponse = Type.Object({
  data: Type.Object({
    url: Type.String(),
  }),
});
export type OAuthAuthorizeInternalResponse = Static<
  typeof OAuthAuthorizeInternalResponse
>;

export const OAuthTokenResponse = Type.Object({
  access_token: Type.String(),
  id_token: Type.Optional(Type.String()),
  refresh_token: Type.Optional(Type.String()),
  expires_in: Type.Number(),
});
export type OAuthTokenResponse = Static<typeof OAuthTokenResponse>;

export const OAuthConfigurationResponse = Type.Object({
  issuer: Type.String({ format: "uri" }),
  authorization_endpoint: Type.String({ format: "uri" }),
  token_endpoint: Type.String({ format: "uri" }),
  jwks_uri: Type.String({ format: "uri" }),
  response_types_supported: Type.Array(Type.String()),
  id_token_signing_alg_values_supported: Type.Array(Type.String()),
});
export type OAuthConfigurationResponse = Static<
  typeof OAuthConfigurationResponse
>;

export const AdminListTeamTagsResponse = Type.Object({
  data: Type.Object({
    tags: Type.Array(TeamTag),
  }),
});
export type AdminListTeamTagsResponse = Static<
  typeof AdminListTeamTagsResponse
>;

export const AdminListDivisionsResponse = Type.Object({
  data: Type.Object({
    tags: Type.Array(Division),
  }),
});
export type AdminListDivisionsResponse = Static<
  typeof AdminListDivisionsResponse
>;

export const AdminTeamTagResponse = Type.Object({
  data: TeamTag,
});
export type AdminTeamTagResponse = Static<typeof AdminTeamTagResponse>;

export const AdminDivisionResponse = Type.Object({
  data: Division,
});
export type AdminDivisionResponse = Static<typeof AdminDivisionResponse>;

export const ListSessionsResponse = Type.Object({
  data: Type.Object({
    entries: Type.Array(Session),
    page_size: Type.Integer(),
    total: Type.Integer(),
  }),
});
export type ListSessionsResponse = Static<typeof ListSessionsResponse>;

export const AdminPolicyResponse = Type.Object({
  data: PolicyDocument,
});
export type AdminPolicyResponse = Static<typeof AdminPolicyResponse>;

export const AdminListPolicyResponse = Type.Object({
  data: Type.Array(PolicyDocument),
});
export type AdminListPolicyResponse = Static<typeof AdminListPolicyResponse>;

export const AdminResetPasswordResponse = Type.Object({
  data: Type.String({ format: "uri" }),
});
export type AdminResetPasswordResponse = Static<
  typeof AdminResetPasswordResponse
>;
