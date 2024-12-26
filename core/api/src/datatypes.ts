import type { Static } from "@sinclair/typebox";
import { Type } from "@sinclair/typebox";

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
  data: Type.String(),
  created_at: TypeDate,
});
export type AuditLogEntry = Static<typeof AuditLogEntry>;

export const Team = Type.Object({
  id: Type.Number(),
  name: Type.String({ maxLength: 64 }),
  bio: Type.String({ maxLength: 256 }),
  join_code: Type.String({ maxLength: 256 }),
  flags: Type.Array(Type.String()),
  created_at: TypeDate,
});
export type Team = Static<typeof Team>;

export const UserIdentity = Type.Object({
  user_id: Type.Number(),
  provider: Type.String(),
  provider_id: Type.String(),
  secret_data: Type.Optional(Type.String()),
  created_at: TypeDate,
});
export type UserIdentity = Static<typeof UserIdentity>;

export const ChallengePrivateMetadataBase = Type.Object({
  solve: Type.Object(
    {
      provider: Type.String({ maxLength: 32 }),
      flags: Type.Optional(
        Type.Array(
          Type.Object({
            data: Type.String(),
            strategy: Type.String(),
          }),
        ),
      ),
    },
    { additionalProperties: false },
  ),
  score: Type.Object(
    {
      constants: Type.Array(Type.Number()),
      strategy: Type.String(),
    },
    { additionalProperties: false },
  ),
  files: Type.Record(
    Type.String(),
    Type.Object(
      {
        ref: Type.String(),
        is_attachment: Type.Boolean(),
      },
      { additionalProperties: false },
    ),
  ),
});
export type ChallengePrivateMetadataBase = Static<
  typeof ChallengePrivateMetadataBase
>;

export const Challenge = Type.Object({
  id: Type.Number(),
  slug: Slug,
  title: Type.String({ maxLength: 128 }),
  description: Type.String(),
  private_metadata: Type.Any(),
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
  Type.Omit(Challenge, [
    "private_metadata",
    "tags",
    "version",
    "created_at",
    "updated_at",
  ]),
  Type.Object({
    metadata: Type.Any(),
  }),
]);
export type PublicChallenge = Static<typeof PublicChallenge>;

export const ChallengeSummary = Type.Pick(Challenge, [
  "id",
  "slug",
  "title",
  "tags",
  "hidden",
  "can_submit",
  "visible_at",
  "created_at",
  "updated_at",
]);
export type ChallengeSummary = Static<typeof ChallengeSummary>;

export const PublicChallengeSummary = Type.Omit(ChallengeSummary, [
  "created_at",
  "updated_at",
  "version",
]);
export type PublicChallengeSummary = Static<typeof PublicChallengeSummary>;

export const CaptchaValidationString = Type.Optional(
  Type.String({ maxLength: 1024 }),
);
export type CaptchaValidationString = Static<typeof CaptchaValidationString>;

export const FileMetadata = Type.Object({
  filename: Type.String(),
  mime: Type.String(),
  size: Type.Number(),
  hash: Type.String(),
});
export type FileMetadata = Static<typeof FileMetadata>;

export const ScoringStrategy = Type.Object(
  {
    expr: Type.String({ maxLength: 1024 }),
    description: Type.String({ maxLength: 256 }),
  },
  { additionalProperties: false },
);
export type ScoringStrategy = Static<typeof ScoringStrategy>;
