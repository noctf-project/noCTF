import { GetCaptchaConfig } from "@noctf/api/contract/captcha";
import { ServiceCradle } from "@noctf/server-core";
import { route } from "@noctf/server-core/util/route";
import type { FastifyInstance } from "fastify";

export async function routes(fastify: FastifyInstance) {
  const { policyService, captchaService } = fastify.container
    .cradle as ServiceCradle;

  route(fastify, GetCaptchaConfig, {}, async (request) => {
    const { provider, public_key, private_key, routes } =
      await captchaService.getConfig();
    if (
      !provider ||
      !public_key ||
      !private_key ||
      !routes ||
      (await policyService.evaluate(request.user?.id || 0, ["bypass.captcha"]))
    ) {
      return { data: undefined };
    }
    return {
      data: {
        provider,
        public_key,
        routes,
      },
    };
  });
}
