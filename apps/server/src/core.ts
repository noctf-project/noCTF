import { Service } from "@noctf/server-core";

import { initServer as auth } from "@noctf/plugin-auth";
import { initServer as setup } from "@noctf/plugin-setup";
import captcha from "./routes/captcha.ts";

export default async function (fastify: Service) {
  fastify.register(auth);
  fastify.register(setup);
  fastify.register(captcha);
}
