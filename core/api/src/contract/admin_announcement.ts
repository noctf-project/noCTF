import { IdParams } from "../params.ts";
import {
  AdminCreateAnnouncementRequest,
  AdminQueryAnnouncementsRequest,
  AdminUpdateAnnouncementRequest,
} from "../requests.ts";
import {
  AdminGetAnnouncementDeliveryChannelsResponse,
  AdminGetAnnouncementResponse,
  AdminListAnnnouncementsResponse,
  BaseResponse,
} from "../responses.ts";
import { RouteDef } from "../types.ts";

export const AdminQueryAnnouncements = {
  method: "POST",
  url: "/admin/announcements/query",
  schema: {
    tags: ["admin"],
    body: AdminQueryAnnouncementsRequest,
    response: {
      200: AdminListAnnnouncementsResponse,
    },
  },
} as const satisfies RouteDef;

export const AdminGetAnnouncementDeliveryChannels = {
  method: "GET",
  url: "/admin/announcements/delivery_channels",
  schema: {
    tags: ["admin"],
    response: {
      200: AdminGetAnnouncementDeliveryChannelsResponse,
    },
  },
} as const satisfies RouteDef;

export const AdminCreateAnnouncement = {
  method: "POST",
  url: "/admin/announcements",
  schema: {
    tags: ["admin"],
    response: {
      200: AdminGetAnnouncementResponse,
    },
    body: AdminCreateAnnouncementRequest,
  },
} as const satisfies RouteDef;

export const AdminUpdateAnnouncement = {
  method: "PUT",
  url: "/admin/announcements/:id",
  schema: {
    tags: ["admin"],
    response: {
      200: AdminGetAnnouncementResponse,
      201: AdminGetAnnouncementResponse,
    },
    params: IdParams,
    body: AdminUpdateAnnouncementRequest,
  },
} as const satisfies RouteDef;

export const AdminDeleteAnnouncement = {
  method: "DELETE",
  url: "/admin/announcements/:id",
  schema: {
    tags: ["admin"],
    response: {
      200: BaseResponse,
    },
    params: IdParams,
  },
} as const satisfies RouteDef;
