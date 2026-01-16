import { IdParams } from "../params.ts";
import { AdminFileMetadataResponse } from "../responses.ts";
import { RouteDef } from "../types.ts";

export const AdminGetFileMetadata = {
  method: "GET",
  url: "/admin/files/:id",
  schema: {
    tags: ["admin"],
    params: IdParams,
    response: {
      200: AdminFileMetadataResponse,
    },
  },
} as const satisfies RouteDef;

export const AdminDeleteFile = {
  method: "DELETE",
  url: "/admin/files/:id",
  schema: {
    tags: ["admin"],
    params: IdParams,
  },
} as const satisfies RouteDef;

export const AdminUploadFile = {
  method: "POST",
  url: "/admin/files",
  schema: {
    tags: ["admin"],
    response: {
      201: AdminFileMetadataResponse,
    },
  },
} as const satisfies RouteDef;
