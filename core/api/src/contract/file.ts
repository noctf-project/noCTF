import { LocalFileParams } from "../params.ts";
import { GetFileQuery } from "../query.ts";
import { RouteDef } from "../types.ts";

export const GetLocalFile = {
  method: "GET",
  url: "/files/local/:ref",
  schema: {
    tags: ["file"],
    params: LocalFileParams,
    querystring: GetFileQuery,
  },
} as const satisfies RouteDef;
