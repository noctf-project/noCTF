import { IdParams } from "../params.ts";
import { ScoreboardQuery, ScoreboardTagsQuery } from "../query.ts";
import {
  ScoreboardExportCTFTimeResponse,
  ScoreboardResponse,
  ScoreboardTeamResponse,
} from "../responses.ts";
import { RouteDef } from "../types.ts";

export const GetScoreboard = {
  method: "GET",
  url: "/scoreboard/divisions/:id",
  schema: {
    tags: ["scoreboard"],
    querystring: ScoreboardQuery,
    params: IdParams,
    response: {
      200: ScoreboardResponse,
    },
  },
} as const satisfies RouteDef;

export const GetTeamScoreboard = {
  method: "GET",
  url: "/scoreboard/teams/:id",
  schema: {
    tags: ["scoreboard"],
    querystring: ScoreboardTagsQuery,
    params: IdParams,
    response: {
      200: ScoreboardTeamResponse,
    },
  },
} as const satisfies RouteDef;

export const ExportScoreboardCTFTime = {
  method: "GET",
  url: "/scoreboard/divisions/:id/ctftime",
  schema: {
    tags: ["scoreboard"],
    params: IdParams,
    response: {
      200: ScoreboardExportCTFTimeResponse,
    },
  },
} as const satisfies RouteDef;
