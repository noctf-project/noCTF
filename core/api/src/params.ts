import type { Static } from "@sinclair/typebox";
import { Type } from "@sinclair/typebox";

export const GetChallengeParams = Type.Object(
  {
    id: Type.Number(),
  },
  { additionalProperties: false },
);
export type GetChallengeParams = Static<typeof GetChallengeParams>;

export const GetChallengeFileParams = Type.Object(
  {
    id: Type.Number(),
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
