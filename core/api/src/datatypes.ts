import type { Static } from "@sinclair/typebox";
import { Type } from "@sinclair/typebox";
import { SubmissionStatus } from "./enums.ts";

export const TypeDate = Type.Transform(
  Type.Unsafe<Date>({
    type: "string",
    format: "date-time",
  }),
)
  .Decode((x) => x.toISOString())
  .Encode((x) => new Date(x));
export type TypeDate = Static<typeof TypeDate>;

export const Slug = Type.String({
  maxLength: 64,
  pattern: "^(?!\\d+$)[a-z\\d][-a-z\\d]*[a-z\\d]$",
});
export type Slug = Static<typeof Slug>;

export const AuthMethod = Type.Object({
  provider: Type.String(),
  name: Type.Optional(Type.String()),
  image_src: Type.Optional(Type.String()),
});
export type AuthMethod = Static<typeof AuthMethod>;

export const AuditLogEntry = Type.Object({
  actor: Type.String(),
  operation: Type.String(),
  entities: Type.Array(Type.String()),
  data: Type.Union([Type.String(), Type.Null()]),
  created_at: TypeDate,
});
export type AuditLogEntry = Static<typeof AuditLogEntry>;

export const Team = Type.Object({
  id: Type.Number(),
  name: Type.String({ maxLength: 64 }),
  bio: Type.String({ maxLength: 256 }),
  country: Type.Union([
    Type.String({ minLength: 3, maxLength: 3 }),
    Type.Null(),
  ]),
  join_code: Type.Union([Type.String({ maxLength: 64 }), Type.Null()]),
  division_id: Type.Number(),
  flags: Type.Array(Type.String()),
  created_at: TypeDate,
});
export type Team = Static<typeof Team>;

export const User = Type.Object({
  id: Type.Number(),
  name: Type.String({ maxLength: 64 }),
  bio: Type.String({ maxLength: 256 }),
  roles: Type.Array(Type.String()),
  created_at: TypeDate,
});
export type User = Static<typeof User>;

export const UserIdentity = Type.Object({
  user_id: Type.Number(),
  provider: Type.String(),
  provider_id: Type.String(),
  secret_data: Type.Optional(Type.String()),
  created_at: TypeDate,
});
export type UserIdentity = Static<typeof UserIdentity>;

export enum ChallengeSolveInputType {
  Text = "text",
  TextArea = "textarea",
  None = "none",
}
export const ChallengePrivateMetadataBase = Type.Object(
  {
    solve: Type.Object(
      {
        source: Type.String({ maxLength: 64 }),
        flag: Type.Optional(
          Type.Array(
            Type.Object({
              data: Type.String(),
              strategy: Type.String(),
            }),
          ),
        ),
        manual: Type.Optional(
          Type.Object({
            allow_cancel: Type.Boolean(),
            input_type: Type.Enum(ChallengeSolveInputType),
          }),
        ),
      },
      { additionalProperties: false },
    ),
    score: Type.Object(
      {
        params: Type.Record(Type.String(), Type.Number()),
        strategy: Type.String(),
        bonus: Type.Optional(Type.Array(Type.Number())),
      },
      { additionalProperties: false },
    ),
    files: Type.Array(
      Type.Object(
        {
          id: Type.Number(),
          is_attachment: Type.Boolean(),
        },
        { additionalProperties: false },
      ),
    ),
  },
  { additionalProperties: true },
);
export type ChallengePrivateMetadataBase = Static<
  typeof ChallengePrivateMetadataBase
>;

export const ChallengePublicMetadataBase = Type.Object(
  {
    solve: Type.Object({
      input_type: Type.Enum(ChallengeSolveInputType),
    }),
    files: Type.Array(
      Type.Object({
        filename: Type.String(),
        size: Type.Number(),
        hash: Type.String(),
        url: Type.String(),
      }),
    ),
  },
  { additionalProperties: true },
);
export type ChallengePublicMetadataBase = Static<
  typeof ChallengePublicMetadataBase
>;

export const Challenge = Type.Object({
  id: Type.Number(),
  slug: Slug,
  title: Type.String({ maxLength: 128 }),
  description: Type.String(),
  private_metadata: ChallengePrivateMetadataBase,
  tags: Type.Record(
    Type.String({ maxLength: 64 }),
    Type.String({ maxLength: 64 }),
  ),
  hidden: Type.Boolean(),
  version: Type.Number(),
  visible_at: Type.Union([TypeDate, Type.Null()]),
  created_at: TypeDate,
  updated_at: TypeDate,
});
export type Challenge = Static<typeof Challenge>;

export const PublicChallenge = Type.Intersect([
  Type.Omit(Challenge, ["private_metadata", "tags", "version", "created_at"]),
  Type.Object({
    metadata: ChallengePublicMetadataBase,
  }),
]);
export type PublicChallenge = Static<typeof PublicChallenge>;

export const ChallengeMetadata = Type.Pick(Challenge, [
  "id",
  "slug",
  "title",
  "tags",
  "private_metadata",
  "hidden",
  "can_submit",
  "visible_at",
  "created_at",
  "updated_at",
]);
export type ChallengeMetadata = Static<typeof ChallengeMetadata>;

export const ChallengeSummary = Type.Omit(ChallengeMetadata, [
  "private_metadata",
]);
export type ChallengeSummary = Static<typeof ChallengeSummary>;

export const PublicChallengeSummary = Type.Omit(ChallengeSummary, [
  "created_at",
  "updated_at",
  "visible_at",
  "hidden",
  "version",
]);
export type PublicChallengeSummary = Static<typeof PublicChallengeSummary>;

export const CaptchaValidationString = Type.Optional(
  Type.String({ maxLength: 512 }),
);
export type CaptchaValidationString = Static<typeof CaptchaValidationString>;

export const FileMetadata = Type.Object({
  id: Type.Number(),
  filename: Type.String(),
  ref: Type.String(),
  mime: Type.String(),
  size: Type.Number(),
  hash: Type.String(),
  url: Type.String(),
  provider: Type.String(),
});
export type FileMetadata = Static<typeof FileMetadata>;

export const ScoringStrategy = Type.Object(
  {
    expr: Type.String({ maxLength: 512 }),
    description: Type.String({ maxLength: 256 }),
    source: Type.Optional(Type.String()),
  },
  { additionalProperties: false },
);
export type ScoringStrategy = Static<typeof ScoringStrategy>;

export const Solve = Type.Object(
  {
    team_id: Type.Number(),
    challenge_id: Type.Number(),
    hidden: Type.Boolean(),
    bonus: Type.Optional(Type.Number()),
    value: Type.Number(),
    created_at: TypeDate,
  },
  { additionalProperties: false },
);
export type Solve = Static<typeof Solve>;

export const Award = Type.Object(
  {
    id: Type.Number(),
    team_id: Type.Number(),
    title: Type.String(),
    value: Type.Number(),
    created_at: TypeDate,
  },
  { additionalProperties: false },
);
export type Award = Static<typeof Award>;

export const ScoreboardEntry = Type.Object({
  team_id: Type.Integer(),
  tag_ids: Type.Array(Type.Integer()),
  score: Type.Number(),
  rank: Type.Integer(),
  last_solve: TypeDate,
  updated_at: TypeDate,
  hidden: Type.Boolean(),
  solves: Type.Array(Type.Omit(Solve, ["team_id"])),
  awards: Type.Array(Type.Omit(Award, ["team_id"])),
});
export type ScoreboardEntry = Static<typeof ScoreboardEntry>;

export const TeamSummary = Type.Composite([
  Type.Omit(Team, ["join_code"]),
  Type.Object({
    members: Type.Array(
      Type.Object({
        user_id: Type.Integer(),
        role: Type.Union([Type.Literal("owner"), Type.Literal("member")]),
      }),
    ),
  }),
]);
export type TeamSummary = Static<typeof TeamSummary>;

export const PublicTeam = Type.Omit(Team, ["join_code", "flags"]);
export type PublicTeam = Static<typeof PublicTeam>;

export const Submission = Type.Object({
  id: Type.Number(),
  user_id: Type.Union([Type.Number(), Type.Null()]),
  team_id: Type.Number(),
  challenge_id: Type.Number(),
  data: Type.String({ maxLength: 512 }),
  comments: Type.String({ maxLength: 512 }),
  source: Type.String({ maxLength: 64 }),
  hidden: Type.Boolean(),
  value: Type.Union([Type.Null(), Type.Number()]),
  status: SubmissionStatus,
  created_at: TypeDate,
  updated_at: TypeDate,
});
export type Submission = Static<typeof Submission>;

export const LimitOffset = Type.Object(
  {
    limit: Type.Optional(Type.Integer({ minimum: 1 })),
    offset: Type.Optional(Type.Number({ minimum: 0 })),
  },
  { additionalProperties: false },
);
export type LimitOffset = Static<typeof LimitOffset>;

export const Division = Type.Object({
  id: Type.Number(),
  name: Type.String({ maxLength: 128 }),
  slug: Type.String({ maxLength: 64 }),
  description: Type.String({ maxLength: 512 }),
  is_visible: Type.Boolean(),
  is_joinable: Type.Boolean(),
  password: Type.String({ maxLength: 64 }),
  created_at: TypeDate,
});
export type Division = Static<typeof Division>;

export const TeamMembership = Type.Object({
  division_id: Type.Number(),
  role: Type.Union([Type.Literal("owner"), Type.Literal("member")]),
  team_id: Type.Number(),
});
export type TeamMembership = Static<typeof TeamMembership>;

export const ScoreboardVersionData = Type.Object({
  version: Type.Number(),
  division_id: Type.Number(),
});
export type ScoreboardVersionData = Static<typeof ScoreboardVersionData>;
