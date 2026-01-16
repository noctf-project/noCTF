import { IdParams } from "../params.ts";
import { DivisionQuery } from "../query.ts";
import { SolveChallengeRequest } from "../requests.ts";
import {
  BaseResponse,
  GetChallengeResponse,
  GetChallengeSolvesResponse,
  ListChallengesResponse,
  SolveChallengeResponse,
} from "../responses.ts";
import { RouteDef } from "../types.ts";

export const ListChallenges = {
  method: "GET",
  url: "/challenges",
  schema: {
    tags: ["challenge"],
    response: {
      200: ListChallengesResponse,
    },
  },
} as const satisfies RouteDef;

export const GetChallenge = {
  method: "GET",
  url: "/challenges/:id",
  schema: {
    tags: ["challenge"],
    params: IdParams,
    response: {
      200: GetChallengeResponse,
      default: BaseResponse,
    },
  },
} as const satisfies RouteDef;

export const GetChallengeSolves = {
  method: "GET",
  url: "/challenges/:id/solves",
  schema: {
    tags: ["challenge"],
    params: IdParams,
    querystring: DivisionQuery,
    response: {
      200: GetChallengeSolvesResponse,
    },
  },
} as const satisfies RouteDef;

export const SolveChallenge = {
  method: "POST",
  url: "/challenges/:id/solves",
  schema: {
    tags: ["challenge"],
    params: IdParams,
    body: SolveChallengeRequest,
    response: {
      200: SolveChallengeResponse,
    },
  },
} as const satisfies RouteDef;
