import { GetCaptchaConfigResponse } from "@noctf/api/responses";
import { CaptchaService } from "./service.ts";
import { ValidationError } from "@noctf/server-core/errors";
import { CloudflareCaptchaProvider, HCaptchaProvider } from "./provider.ts";
import type { FastifyInstance, HTTPMethods } from "fastify";
import { CaptchaHTTPMethod } from "@noctf/api/types";
import "@noctf/server-core/types/fastify";

const VALID_METHODS = new Set(
  Object.values(CaptchaHTTPMethod),
) as Set<HTTPMethods>;

export async function initServer(fastify: FastifyInstance) {
  const { policyService } = fastify.container.cradle;
  const service = new CaptchaService(fastify.container.cradle);
  service.register(new HCaptchaProvider());
  service.register(new CloudflareCaptchaProvider());

  fastify.get<{ Reply: GetCaptchaConfigResponse }>(
    "/captcha",
    {
      schema: {
        response: {
          200: GetCaptchaConfigResponse,
        },
      },
    },
    async (request) => {
      const { provider, public_key, private_key, routes } =
        await service.getConfig();
      if (
        !provider ||
        !public_key ||
        !private_key ||
        !routes ||
        (await policyService.evaluate(request.user?.id, ["bypass.captcha"]))
      ) {
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
    Headers: {
      "x-noctf-captcha": string;
    };
  }>("preHandler", async (request) => {
    const path = request.routeOptions.url;
    const method = request.routeOptions.method as HTTPMethods;
    // short circuit to make less expensive, we don't particularly care about GET or OPTIONS
    if (!VALID_METHODS.has(method)) {
      return;
    }
    const { provider, public_key, private_key, routes } =
      await service.getConfig();
    if (
      !provider ||
      !public_key ||
      !private_key ||
      !routes ||
      !routes.some((x) => method === x.method && path === x.path) ||
      (await policyService.evaluate(request.user?.id, ["bypass.captcha"]))
    ) {
      return;
    }
    const captcha = request.headers["x-noctf-captcha"];
    if (typeof captcha !== "string") {
      throw new ValidationError("CAPTCHA response is not a string");
    }
    await service.validate(captcha, request.ip);
  });
}

// We need the below line to tell fastify to not create a new scope
/* eslint-disable @typescript-eslint/no-explicit-any */
(initServer as any)[Symbol.for("skip-override")] = true;
