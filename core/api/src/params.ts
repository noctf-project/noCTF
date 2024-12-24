import type { Static } from "@sinclair/typebox";
import { Type } from "@sinclair/typebox";
import { Slug } from "./datatypes.ts";

export const GetChallengeParams = Type.Object(
  {
    id_or_slug: Type.Union([Type.Number(), Slug]),
  },
  { additionalProperties: false },
);
export type GetChallengeParams = Static<typeof GetChallengeParams>;

export const GetChallengeFileParams = Type.Object(
  {
    id_or_slug: Type.Union([Type.Number(), Slug]),
    filename: Type.String(),
  },
  { additionalProperties: false },
);
export type GetChallengeFileParams = Static<typeof GetChallengeFileParams>;

export const FileParams = Type.Object(
  {
    ref: Type.String({ maxLength: 64, pattern: "^[A-Za-z0-9_-]+" }),
  },
  { additionalProperties: false },
);
export type FileParams = Static<typeof FileParams>;
