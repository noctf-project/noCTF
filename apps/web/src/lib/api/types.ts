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

export type SponsorDetails = {
  name: string;
  logo: string;
  description?: {
    text: string;
    links: string[];
  };
  level: "platinum" | "gold" | "silver" | "infra";
  url: string;
};

export type SponsorTier = "platinum" | "gold" | "silver" | "infra";
