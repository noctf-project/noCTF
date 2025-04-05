import { Static, Type } from "@sinclair/typebox";
import { Challenge } from "./datatypes.ts";

export const FilterChallengesQuery = Type.Partial(
  Type.Pick(Challenge, ["tags", "hidden", "visible_at"]),
);
export type FilterChallengesQuery = Static<typeof FilterChallengesQuery>;

export const ScoreboardQuery = Type.Object({
  page: Type.Optional(Type.Integer({ minimum: 1 })),
  page_size: Type.Optional(Type.Integer()),
});
export type ScoreboardQuery = Static<typeof ScoreboardQuery>;

export const ListTeamsQuery = Type.Object({
  division_id: Type.Optional(Type.Integer()),
});
export type ListTeamsQuery = Static<typeof ListTeamsQuery>;

export const QueryTeamNamesQuery = Type.Object({
  id: Type.Array(Type.Integer({ minimum: 1 }), { maxItems: 100 }),
});
export type QueryTeamNamesQuery = Static<typeof QueryTeamNamesQuery>;
