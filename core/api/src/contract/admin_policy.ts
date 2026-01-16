import { IdParams } from "../params.ts";
import {
  AdminCreatePolicyRequest,
  AdminUpdatePolicyRequest,
} from "../requests.ts";
import {
  AdminListPolicyResponse,
  AdminPolicyResponse,
  BaseResponse,
} from "../responses.ts";
import { RouteDef } from "../types.ts";

export const AdminListPolicies = {
  method: "GET",
  url: "/admin/policies",
  schema: {
    tags: ["admin"],
    response: {
      200: AdminListPolicyResponse,
    },
  },
} as const satisfies RouteDef;

export const AdminCreatePolicy = {
  method: "POST",
  url: "/admin/policies",
  schema: {
    tags: ["admin"],
    response: {
      200: AdminPolicyResponse,
    },
    body: AdminCreatePolicyRequest,
  },
} as const satisfies RouteDef;

export const AdminUpdatePolicy = {
  method: "PUT",
  url: "/admin/policies/:id",
  schema: {
    tags: ["admin"],
    response: {
      200: BaseResponse,
    },
    params: IdParams,
    body: AdminUpdatePolicyRequest,
  },
} as const satisfies RouteDef;

export const AdminDeletePolicy = {
  method: "DELETE",
  url: "/admin/policies/:id",
  schema: {
    tags: ["admin"],
    response: {
      200: BaseResponse,
    },
    params: IdParams,
  },
} as const satisfies RouteDef;
