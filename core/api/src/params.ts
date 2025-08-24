import type { Static } from "@sinclair/typebox";
import { Type } from "@sinclair/typebox";

export const IdParams = Type.Object(
  {
    id: Type.Number(),
  },
  { additionalProperties: false },
);
export type IdParams = Static<typeof IdParams>;

export const IdOrSlugParams = Type.Object(
  {
    id: Type.String(),
  },
  { additionalProperties: false },
);
export type IdOrSlugParams = Static<typeof IdOrSlugParams>;

export const LocalFileParams = Type.Object(
  {
    ref: Type.String({ maxLength: 64, pattern: "^[A-Za-z0-9_-]+$" }),
  },
  { additionalProperties: false },
);
export type LocalFileParams = Static<typeof LocalFileParams>;
