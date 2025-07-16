import { Static, Type } from "@sinclair/typebox";
import { Challenge, TypeDate } from "./datatypes.ts";

export const FilterChallengesQuery = Type.Partial(
  Type.Pick(Challenge, ["tags", "hidden", "visible_at"]),
);
export type FilterChallengesQuery = Static<typeof FilterChallengesQuery>;

export const PaginatedQuery = Type.Object(
  {
    page: Type.Optional(Type.Integer({ minimum: 1 })),
    page_size: Type.Optional(Type.Integer()),
  },
  { additionalProperties: false },
);
export type PaginatedQuery = Static<typeof PaginatedQuery>;

export const ScoreboardQuery = Type.Composite(
  [
    PaginatedQuery,
    Type.Object({
      tags: Type.Optional(Type.Array(Type.Number(), { maxItems: 10 })),
    }),
  ],
  { additionalProperties: false },
);
export type ScoreboardQuery = Static<typeof ScoreboardQuery>;

export const ScoreboardTagsQuery = Type.Pick(ScoreboardQuery, ["tags"]);
export type ScoreboardTagsQuery = Static<typeof ScoreboardTagsQuery>;

export const GetFileQuery = Type.Object(
  {
    sig: Type.String({ maxLength: 255 }),
    iat: Type.Number(),
  },
  { additionalProperties: false },
);
export type GetFileQuery = Static<typeof GetFileQuery>;

export const DivisionQuery = Type.Object(
  {
    division_id: Type.Optional(Type.Integer()),
  },
  { additionalProperties: false },
);
export type DivisionQuery = Static<typeof DivisionQuery>;

export const SessionQuery = Type.Composite(
  [
    PaginatedQuery,
    Type.Object({
      active: Type.Optional(Type.Boolean()),
    }),
  ],
  { additionalProperties: false },
);
export type SessionQuery = Static<typeof SessionQuery>;

export const GetAnnouncementsQuery = Type.Object(
  {
    updated_at: Type.Optional(TypeDate),
  },
  { additionalProperties: false },
);
export type GetAnnouncementsQuery = Static<typeof GetAnnouncementsQuery>;
