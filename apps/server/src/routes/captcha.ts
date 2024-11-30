import { CaptchaConfigResponse } from "@noctf/api/responses";
import { Service } from "@noctf/server-core";

export default async function (fastify: Service) {
  const { captchaService } = fastify.container.cradle;
  fastify.get<{ Reply: CaptchaConfigResponse }>(
    "/captcha",
    {
      schema: {
        response: {
          200: CaptchaConfigResponse,
        },
      },
    },
    async () => ({
      data: await captchaService.getProviderData(),
    }),
  );
}
