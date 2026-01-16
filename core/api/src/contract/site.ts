import {
  GetAnnouncementsResponse,
  GetSiteConfigResponse,
} from "../responses.ts";
import { GetAnnouncementsQuery } from "../query.ts";
import { RouteDef } from "../types.ts";
import { Type } from "@sinclair/typebox";

export const GetAnnouncements = {
  method: "GET",
  url: "/announcements",
  schema: {
    tags: ["site"],
    description: "Get Site Announcements",
    querystring: GetAnnouncementsQuery,
    response: {
      200: GetAnnouncementsResponse,
    },
  },
} as const satisfies RouteDef;

export const GetSiteConfig = {
  method: "GET",
  url: "/site/config",
  schema: {
    tags: ["site"],
    response: {
      200: GetSiteConfigResponse,
    },
  },
} as const satisfies RouteDef;

export const GetHealthz = {
  method: "GET",
  url: "/healthz",
  schema: {
    tags: ["site"],
    response: {
      200: Type.Object({
        status: Type.Union([Type.Literal("OK"), Type.Literal("ERROR")]),
      }),
    },
  },
} as const satisfies RouteDef;
