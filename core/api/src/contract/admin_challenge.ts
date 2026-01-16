import {
  AdminCreateChallengeRequest,
  AdminUpdateChallengeRequest,
} from "../requests.ts";
import {
  AdminGetChallengeResponse,
  AdminGetScoringStrategiesResponse,
  AdminListChallengesResponse,
  AdminUpdateChallengeResponse,
  AnyResponse,
  BaseResponse,
} from "../responses.ts";
import { FilterChallengesQuery } from "../query.ts";
import { IdOrSlugParams, IdParams } from "../params.ts";
import { RouteDef } from "../types.ts";

export const AdminGetScoringStrategies = {
  method: "GET",
  url: "/admin/scoring_strategies",
  schema: {
    tags: ["admin"],
    response: {
      200: AdminGetScoringStrategiesResponse,
    },
  },
} as const satisfies RouteDef;

export const AdminListChallenges = {
  method: "GET",
  url: "/admin/challenges",
  schema: {
    tags: ["admin"],
    querystring: FilterChallengesQuery,
    response: {
      200: AdminListChallengesResponse,
    },
  },
} as const satisfies RouteDef;

export const AdminCreateChallenge = {
  method: "POST",
  url: "/admin/challenges",
  schema: {
    tags: ["admin"],
    body: AdminCreateChallengeRequest,
    response: {
      201: AdminGetChallengeResponse,
    },
  },
} as const satisfies RouteDef;

export const AdminGetChallenge = {
  method: "GET",
  url: "/admin/challenges/:id",
  schema: {
    tags: ["admin"],
    params: IdOrSlugParams,
    response: {
      200: AdminGetChallengeResponse,
    },
  },
} as const satisfies RouteDef;

export const AdminUpdateChallenge = {
  method: "PUT",
  url: "/admin/challenges/:id",
  schema: {
    tags: ["admin"],
    params: IdParams,
    body: AdminUpdateChallengeRequest,
    response: {
      200: AdminUpdateChallengeResponse,
    },
  },
} as const satisfies RouteDef;

export const AdminDeleteChallenge = {
  method: "DELETE",
  url: "/admin/challenges/:id",
  schema: {
    tags: ["admin"],
    params: IdParams,
    response: {
      200: BaseResponse,
    },
  },
} as const satisfies RouteDef;

export const AdminGetChallengePrivateMetadataSchema = {
  method: "GET",
  url: "/admin/challenges/schema/private_metadata",
  schema: {
    tags: ["admin"],
    response: {
      200: AnyResponse,
    },
  },
} as const satisfies RouteDef;
