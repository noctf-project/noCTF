import { BaseResponse } from "../responses.ts";
import { AdminScoreboardTriggerRequest } from "../requests.ts";
import { RouteDef } from "../types.ts";

export const AdminScoreboardTrigger = {
  method: "POST",
  url: "/admin/scoreboard/trigger",
  schema: {
    tags: ["admin"],
    body: AdminScoreboardTriggerRequest,
    response: {
      200: BaseResponse,
    },
  },
} as const satisfies RouteDef;
