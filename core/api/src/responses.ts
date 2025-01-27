import type { Static } from "@sinclair/typebox";
import { Type } from "@sinclair/typebox";
import {
  AuditLogEntry,
  AuthMethod,
  Challenge,
  FileMetadata,
  PublicChallenge,
  PublicChallengeSummary,
  ChallengeSolveStatus,
  Team,
  TypeDate,
} from "./datatypes.ts";
import { AuthRegisterToken, AuthTokenType } from "./token.ts";

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
  data: Type.Array(
    Type.Object({
      team_id: Type.Number(),
      score: Type.Number(),
      created_at: TypeDate,
    }),
  ),
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

export const SolveChallengeResponse = Type.Object(
  {
    data: Type.Enum(ChallengeSolveStatus),
  },
  { additionalProperties: false },
);
export type SolveChallengeResponse = Static<typeof SolveChallengeResponse>;
