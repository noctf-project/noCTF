import { CaptchaConfigResponse } from "@noctf/api/responses";
import { Service } from "@noctf/server-core";
import { CaptchaService } from "./service.ts";
import { RESTRICTED_METHODS } from "./config.ts";
import { ValidationError } from "@noctf/server-core/errors";

export async function initServer(fastify: Service) {
  const service = new CaptchaService(fastify.container.cradle);

  fastify.get<{ Reply: CaptchaConfigResponse }>(
    "/captcha",
    {
      schema: {
        response: {
          200: CaptchaConfigResponse,
        },
      },
    },
    async () => {
      const { provider, public_key, private_key, routes } =
        await service.getConfig();
      if (!provider || !public_key || !private_key || !routes) {
        return { data: null };
      }
      return {
        data: {
          provider,
          public_key,
          routes,
        },
      };
    },
  );

  fastify.addHook<{
    Body: {
      captcha: string;
    };
  }>("preHandler", async (request, reply) => {
    if (!RESTRICTED_METHODS.has(request.method)) {
      return;
    }
    const { provider, public_key, private_key, routes } =
      await service.getConfig();
    if (
      !provider ||
      !public_key ||
      !private_key ||
      !routes ||
      !routes.includes(request.routeOptions.url)
    ) {
      return;
    }
    if (typeof request.body.captcha !== "string") {
      throw new ValidationError("CAPTCHA response is not a string");
    }
    await service.validate(request.body.captcha, request.ip);
  });
}

// We need the below line to tell fastify to not create a new scope
/* eslint-disable @typescript-eslint/no-explicit-any */
(initServer as any)[Symbol.for("skip-override")] = true;
