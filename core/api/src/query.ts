import { Static, Type } from "@sinclair/typebox";
import { Challenge } from "./datatypes.ts";

export const FilterChallengesQuery = Type.Partial(
  Type.Pick(Challenge, ["tags", "hidden", "visible_at"]),
);
export type FilterChallengesQuery = Static<typeof FilterChallengesQuery>;
