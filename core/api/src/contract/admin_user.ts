import { IdParams } from "../params.ts";
import { SessionQuery } from "../query.ts";
import {
  AdminQueryUsersRequest,
  AdminRevokeSessionsRequest,
  AdminUpdateUserRequest,
} from "../requests.ts";
import {
  AdminListUsersResponse,
  AdminResetPasswordResponse,
  BaseResponse,
  ListSessionsResponse,
} from "../responses.ts";
import { RouteDef } from "../types.ts";

export const AdminQueryUsers = {
  method: "POST",
  url: "/admin/users/query",
  schema: {
    tags: ["admin"],
    body: AdminQueryUsersRequest,
    response: {
      200: AdminListUsersResponse,
    },
  },
} as const satisfies RouteDef;

export const AdminUpdateUser = {
  method: "PUT",
  url: "/admin/users/:id",
  schema: {
    tags: ["admin"],
    body: AdminUpdateUserRequest,
    params: IdParams,
    response: {
      200: BaseResponse,
    },
  },
} as const satisfies RouteDef;

export const AdminDeleteUser = {
  method: "DELETE",
  url: "/admin/users/:id",
  schema: {
    tags: ["admin"],
    response: {
      200: BaseResponse,
    },
    params: IdParams,
  },
} as const satisfies RouteDef;

export const AdminGetUserSessions = {
  method: "GET",
  url: "/admin/users/:id/sessions",
  schema: {
    tags: ["admin"],
    params: IdParams,
    querystring: SessionQuery,
    response: {
      200: ListSessionsResponse,
    },
  },
} as const satisfies RouteDef;

export const AdminRevokeUserSessions = {
  method: "POST",
  url: "/admin/users/:id/sessions/revoke",
  schema: {
    tags: ["admin"],
    params: IdParams,
    body: AdminRevokeSessionsRequest,
    response: {
      200: BaseResponse,
    },
  },
} as const satisfies RouteDef;

export const AdminResetUserPassword = {
  method: "POST",
  url: "/admin/users/:id/reset_password",
  schema: {
    tags: ["admin"],
    params: IdParams,
    response: {
      200: AdminResetPasswordResponse,
    },
  },
} as const satisfies RouteDef;
