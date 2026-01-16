import { DivisionQuery } from "../query.ts";
import {
  ListUserStatsResponse,
  ListChallengeStatsResponse,
} from "../responses.ts";
import { RouteDef } from "../types.ts";

export const GetUserStats = {
  method: "GET",
  url: "/stats/users",
  schema: {
    tags: ["stats"],
    response: {
      200: ListUserStatsResponse,
    },
  },
} as const satisfies RouteDef;

export const GetChallengeStats = {
  method: "GET",
  url: "/stats/challenges",
  schema: {
    tags: ["stats"],
    querystring: DivisionQuery,
    response: {
      200: ListChallengeStatsResponse,
    },
  },
} as const satisfies RouteDef;
