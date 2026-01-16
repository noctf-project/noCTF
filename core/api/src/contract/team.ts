import {
  CreateTeamRequest,
  JoinTeamRequest,
  QueryTeamsRequest,
  UpdateTeamRequest,
} from "../requests.ts";
import {
  CreateTeamResponse,
  ListDivisionsResponse,
  ListTeamsResponse,
  ListTeamTagsResponse,
  MeTeamResponse,
  UpdateTeamResponse,
} from "../responses.ts";
import { RouteDef } from "../types.ts";

export const ListDivisions = {
  method: "GET",
  url: "/divisions",
  schema: {
    tags: ["division"],
    response: {
      200: ListDivisionsResponse,
    },
  },
} as const satisfies RouteDef;

export const ListTeamTags = {
  method: "GET",
  url: "/team_tags",
  schema: {
    tags: ["team"],
    response: {
      200: ListTeamTagsResponse,
    },
  },
} as const satisfies RouteDef;

export const CreateTeam = {
  method: "POST",
  url: "/teams",
  schema: {
    tags: ["team"],
    body: CreateTeamRequest,
    response: {
      201: CreateTeamResponse,
    },
  },
} as const satisfies RouteDef;

export const JoinTeam = {
  method: "POST",
  url: "/team/join",
  schema: {
    tags: ["team"],
    body: JoinTeamRequest,
    response: {
      201: MeTeamResponse,
    },
  },
} as const satisfies RouteDef;

export const LeaveTeam = {
  method: "DELETE",
  url: "/team/join",
  schema: {
    tags: ["team"],
  },
} as const satisfies RouteDef;

export const GetMyTeam = {
  method: "GET",
  url: "/team",
  schema: {
    tags: ["team"],
    response: {
      200: MeTeamResponse,
    },
  },
} as const satisfies RouteDef;

export const UpdateTeam = {
  method: "PUT",
  url: "/team",
  schema: {
    tags: ["team"],
    body: UpdateTeamRequest,
    response: {
      200: UpdateTeamResponse,
    },
  },
} as const satisfies RouteDef;

export const QueryTeams = {
  method: "POST",
  url: "/teams/query",
  schema: {
    tags: ["team"],
    response: {
      200: ListTeamsResponse,
    },
    body: QueryTeamsRequest,
  },
} as const satisfies RouteDef;
