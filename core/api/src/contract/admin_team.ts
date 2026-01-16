import { IdParams } from "../params.ts";
import {
  AdminQueryTeamsRequest,
  AdminUpdateTeamMemberRequest,
  AdminUpdateTeamRequest,
} from "../requests.ts";
import {
  AdminListTeamsResponse,
  BaseResponse,
  UpdateTeamResponse,
} from "../responses.ts";
import { RouteDef } from "../types.ts";

export const AdminQueryTeams = {
  method: "POST",
  url: "/admin/teams/query",
  schema: {
    tags: ["admin"],
    response: {
      200: AdminListTeamsResponse,
    },
    body: AdminQueryTeamsRequest,
  },
} as const satisfies RouteDef;

export const AdminUpdateTeam = {
  method: "PUT",
  url: "/admin/teams/:id",
  schema: {
    tags: ["admin"],
    response: {
      200: UpdateTeamResponse,
    },
    body: AdminUpdateTeamRequest,
    params: IdParams,
  },
} as const satisfies RouteDef;

export const AdminDeleteTeam = {
  method: "DELETE",
  url: "/admin/teams/:id",
  schema: {
    tags: ["admin"],
    response: {
      200: BaseResponse,
    },
    params: IdParams,
  },
} as const satisfies RouteDef;

export const AdminUpdateTeamMember = {
  method: "PUT",
  url: "/admin/teams/:id/members",
  schema: {
    tags: ["admin"],
    response: {
      200: BaseResponse,
    },
    params: IdParams,
    body: AdminUpdateTeamMemberRequest,
  },
} as const satisfies RouteDef;
