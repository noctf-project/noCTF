import { Static, Type } from "@sinclair/typebox";
import { Slug } from "./datatypes.ts";

export const GetChallengeParams = Type.Object(
  {
    id_or_slug: Type.Union([Type.Number(), Slug]),
  },
  { additionalProperties: false },
);
export type GetChallengeParams = Static<typeof GetChallengeParams>;
