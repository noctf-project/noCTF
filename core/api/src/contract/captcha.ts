import { GetCaptchaConfigResponse } from "../responses.ts";
import { RouteDef } from "../types.ts";

export const GetCaptchaConfig = {
  method: "GET",
  url: "/captcha",
  schema: {
    tags: ["captcha"],
    description: "Get the active CAPTCHA configuration",
    response: {
      200: GetCaptchaConfigResponse,
    },
  },
} as const satisfies RouteDef;
