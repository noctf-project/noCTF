import { CaptchaHTTPMethod } from "@noctf/api/types";
import { ValidationError } from "@noctf/server-core/errors";
import type { FastifyRequest, HTTPMethods } from "fastify";

const VALID_METHODS = new Set(
  Object.values(CaptchaHTTPMethod),
) as Set<HTTPMethods>;

export const CaptchaHook = async (request: FastifyRequest) => {
  const path = request.routeOptions.url;
  const method = request.routeOptions.method as HTTPMethods;
  // short circuit to make less expensive, we don't particularly care about GET or OPTIONS
  if (!VALID_METHODS.has(method)) {
    return;
  }
  const { policyService, captchaService } = request.server.container.cradle;
  const { provider, public_key, private_key, routes } =
    await captchaService.getConfig();
  if (
    !provider ||
    !public_key ||
    !private_key ||
    !routes ||
    !routes.some((x) => method === x.method && path === x.path) ||
    (await policyService.evaluate(request.user?.id || 0, ["bypass.captcha"]))
  ) {
    return;
  }
  const captcha = request.headers["x-noctf-captcha"];
  if (typeof captcha !== "string") {
    throw new ValidationError("CAPTCHA response is not a string");
  }
  await captchaService.validate(captcha, request.ip);
};
