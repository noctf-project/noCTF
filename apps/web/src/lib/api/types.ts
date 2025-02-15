import type { paths } from "@noctf/openapi-spec";

type HttpMethod = "get" | "post" | "put" | "delete" | "patch";

export type PathResponse<
  P extends keyof paths,
  M extends HttpMethod,
> = paths[P][M] extends {
  responses: { 200: { content: { "application/json": infer R } } };
}
  ? R
  : never;
