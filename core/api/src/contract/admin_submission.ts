import {
  AdminQuerySubmissionsRequest,
  AdminUpdateSubmissionsRequest,
} from "../requests.ts";
import {
  AdminQuerySubmissionsResponse,
  AdminUpdateSubmissionsResponse,
} from "../responses.ts";
import { RouteDef } from "../types.ts";

export const AdminQuerySubmissions = {
  method: "POST",
  url: "/admin/submissions/query",
  schema: {
    tags: ["admin"],
    body: AdminQuerySubmissionsRequest,
    response: {
      200: AdminQuerySubmissionsResponse,
    },
  },
} as const satisfies RouteDef;

export const AdminUpdateSubmissions = {
  method: "PUT",
  url: "/admin/submissions",
  schema: {
    tags: ["admin"],
    body: AdminUpdateSubmissionsRequest,
    response: {
      200: AdminUpdateSubmissionsResponse,
    },
  },
} as const satisfies RouteDef;
