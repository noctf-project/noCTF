import { IdParams } from "../params.ts";
import {
  AdminCreateDivisionRequest,
  AdminCreateTeamTagRequest,
  AdminUpdateDivisionRequest,
  AdminUpdateTeamTagRequest,
} from "../requests.ts";
import {
  AdminDivisionResponse,
  AdminListDivisionsResponse,
  AdminListTeamTagsResponse,
  AdminTeamTagResponse,
  BaseResponse,
} from "../responses.ts";
import { RouteDef } from "../types.ts";

export const AdminListTeamTags = {
  method: "GET",
  url: "/admin/team_tags",
  schema: {
    tags: ["admin"],
    response: {
      200: AdminListTeamTagsResponse,
    },
  },
} as const satisfies RouteDef;

export const AdminCreateTeamTag = {
  method: "POST",
  url: "/admin/team_tags",
  schema: {
    tags: ["admin"],
    response: {
      200: AdminTeamTagResponse,
    },
    body: AdminCreateTeamTagRequest,
  },
} as const satisfies RouteDef;

export const AdminUpdateTeamTag = {
  method: "PUT",
  url: "/admin/team_tags/:id",
  schema: {
    tags: ["admin"],
    response: {
      200: BaseResponse,
    },
    params: IdParams,
    body: AdminUpdateTeamTagRequest,
  },
} as const satisfies RouteDef;

export const AdminDeleteTeamTag = {
  method: "DELETE",
  url: "/admin/team_tags/:id",
  schema: {
    tags: ["admin"],
    response: {
      200: BaseResponse,
    },
    params: IdParams,
  },
} as const satisfies RouteDef;

export const AdminListDivisions = {
  method: "GET",
  url: "/admin/divisions",
  schema: {
    tags: ["admin"],
    response: {
      200: AdminListDivisionsResponse,
    },
  },
} as const satisfies RouteDef;

export const AdminCreateDivision = {
  method: "POST",
  url: "/admin/divisions",
  schema: {
    tags: ["admin"],
    response: {
      200: AdminDivisionResponse,
    },
    body: AdminCreateDivisionRequest,
  },
} as const satisfies RouteDef;

export const AdminUpdateDivision = {
  method: "PUT",
  url: "/admin/divisions/:id",
  schema: {
    tags: ["admin"],
    response: {
      200: BaseResponse,
    },
    params: IdParams,
    body: AdminUpdateDivisionRequest,
  },
} as const satisfies RouteDef;

export const AdminDeleteDivision = {
  method: "DELETE",
  url: "/admin/divisions/:id",
  schema: {
    tags: ["admin"],
    response: {
      200: BaseResponse,
    },
    params: IdParams,
  },
} as const satisfies RouteDef;
