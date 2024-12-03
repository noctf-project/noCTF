import { Service } from "@noctf/server-core";

import { initServer as auth } from "@noctf/mod-auth";
import { initServer as setup } from "@noctf/mod-setup";
import { initServer as captcha } from "@noctf/mod-captcha";
export default async function (fastify: Service) {
  fastify.register(auth);
  fastify.register(setup);
  fastify.register(captcha);
}
