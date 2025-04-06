import type { Static } from "@sinclair/typebox";
import { Type } from "@sinclair/typebox";
import {
  AuditLogEntry,
  AuthMethod,
  Challenge,
  FileMetadata,
  PublicChallenge,
  PublicChallengeSummary,
  Team,
  ScoringStrategy,
  User,
  ScoreboardEntry,
  PublicTeam,
  Solve,
  TypeDate,
  Award,
  Submission,
  Division,
} from "./datatypes.ts";
import { AuthRegisterToken, AuthTokenType } from "./token.ts";
import { SubmissionStatus } from "./enums.ts";

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
    Type.Object({
      provider: Type.String(),
      public_key: Type.String(),
      routes: Type.Array(Type.String()),
    }),
  ),
});
export type GetCaptchaConfigResponse = Static<typeof GetCaptchaConfigResponse>;

export const ListAuthMethodsResponse = Type.Object({
  data: Type.Array(AuthMethod),
});
export type ListAuthMethodsResponse = Static<typeof ListAuthMethodsResponse>;

export const InitAuthOauthResponse = Type.Object({
  data: Type.String(),
});
export type InitAuthOauthResponse = Static<typeof InitAuthOauthResponse>;

export const FinishAuthResponse = Type.Object({
  data: Type.Object({
    type: AuthTokenType,
    token: Type.String(),
  }),
});
export type FinishAuthResponse = Static<typeof FinishAuthResponse>;

export const RegisterAuthTokenResponse = Type.Object({
  data: Type.Omit(AuthRegisterToken, ["type"]),
});
export type RegisterAuthTokenResponse = Static<
  typeof RegisterAuthTokenResponse
>;

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
  data: Team,
});
export type MeTeamResponse = Static<typeof MeTeamResponse>;

export const GetTeamResponse = Type.Object({
  data: PublicTeam,
});
export type GetTeamResponse = Static<typeof GetTeamResponse>;

export const ListTeamsResponse = Type.Object({
  data: Type.Array(PublicTeam),
});
export type ListTeamsResponse = Static<typeof ListTeamsResponse>;

export const MeUserResponse = Type.Object({
  data: Type.Composite([
    User,
    Type.Object({
      team_id: Type.Union([Type.Number(), Type.Null()]),
      team_name: Type.Union([Type.String(), Type.Null()]),
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
          score: Type.Union([Type.Number(), Type.Null()]),
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
    total: Type.Number(),
    page_size: Type.Number(),
    updated_at: TypeDate,
  }),
});
export type ScoreboardResponse = Static<typeof ScoreboardResponse>;

export const ScoreboardTeamResponse = Type.Object({
  data: Type.Object({
    solves: Type.Array(Solve),
    graph: Type.Array(Type.Tuple([Type.Number(), Type.Number()])),
    awards: Type.Array(Award),
  }),
});
export type ScoreboardTeamResponse = Static<typeof ScoreboardTeamResponse>;

export const ScoreboardSolvesResponse = Type.Object({
  data: Type.Array(Solve),
});
export type ScoreboardSolvesResponse = Static<typeof ScoreboardSolvesResponse>;

export const AdminQuerySubmissionsResponse = Type.Object({
  data: Type.Array(Submission),
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
