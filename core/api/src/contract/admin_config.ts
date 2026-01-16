import { Type } from "@sinclair/typebox";
import { UpdateConfigValueRequest } from "../requests.ts";
import {
  AdminGetConfigValueResponse,
  AdminGetConfigSchemaResponse,
} from "../responses.ts";
import { RouteDef } from "../types.ts";

export const AdminGetConfigSchema = {
  method: "GET",
  url: "/admin/config",
  schema: {
    tags: ["admin"],
    response: {
      200: AdminGetConfigSchemaResponse,
    },
  },
} as const satisfies RouteDef;

export const AdminGetConfigValue = {
  method: "GET",
  url: "/admin/config/:namespace",
  schema: {
    tags: ["admin"],
    response: {
      200: AdminGetConfigValueResponse,
    },
    params: Type.Object({
      namespace: Type.String(),
    }),
  },
} as const satisfies RouteDef;

export const AdminUpdateConfigValue = {
  method: "PUT",
  url: "/admin/config/:namespace",
  schema: {
    tags: ["admin"],
    body: UpdateConfigValueRequest,
    params: Type.Object({
      namespace: Type.String(),
    }),
  },
} as const satisfies RouteDef;
