import { IdParams } from "../params.ts";
import { AdminCreateAppRequest, AdminUpdateAppRequest } from "../requests.ts";
import {
  AdminListAppResponse,
  AdminAppResponse,
  AdminAppWithSecretResponse,
  BaseResponse,
} from "../responses.ts";
import { RouteDef } from "../types.ts";
import { Type } from "@sinclair/typebox";

export const AdminListApps = {
  method: "GET",
  url: "/admin/apps",
  schema: {
    tags: ["admin"],
    response: {
      200: AdminListAppResponse,
    },
  },
} as const satisfies RouteDef;

export const AdminCreateApp = {
  method: "POST",
  url: "/admin/apps",
  schema: {
    tags: ["admin"],
    response: {
      200: AdminAppWithSecretResponse,
    },
    body: AdminCreateAppRequest,
  },
} as const satisfies RouteDef;

export const AdminUpdateApp = {
  method: "PUT",
  url: "/admin/apps/:id",
  schema: {
    tags: ["admin"],
    response: {
      200: Type.Union([AdminAppResponse, AdminAppWithSecretResponse]),
    },
    params: IdParams,
    body: AdminUpdateAppRequest,
  },
} as const satisfies RouteDef;

export const AdminDeleteApp = {
  method: "DELETE",
  url: "/admin/apps/:id",
  schema: {
    tags: ["admin"],
    response: {
      200: BaseResponse,
    },
    params: IdParams,
  },
} as const satisfies RouteDef;
