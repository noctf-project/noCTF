import { Static, Type } from "@sinclair/typebox";
import { Challenge } from "./datatypes.ts";

export const FilterChallengesQuery = Type.Partial(
  Type.Pick(Challenge, ["tags", "hidden", "visible_at"]),
);
export type FilterChallengesQuery = Static<typeof FilterChallengesQuery>;

export const ScoreboardQuery = Type.Object({
  page: Type.Optional(Type.Integer({ minimum: 1 })),
  page_size: Type.Optional(Type.Integer()),
  tags: Type.Optional(Type.Array(Type.Number(), { maxItems: 10 })),
});
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

export const SolveQuery = Type.Object(
  {
    division_id: Type.Optional(Type.Integer()),
  },
  { additionalProperties: false },
);
export type SolveQuery = Static<typeof SolveQuery>;
