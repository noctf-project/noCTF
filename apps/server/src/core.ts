import { routes as adminConfig } from "./routes/admin_config.ts";

import { initServer as auth } from "@noctf/mod-auth";
import { initServer as setup } from "@noctf/mod-setup";
import { initServer as captcha } from "@noctf/mod-captcha";
import { initServer as team } from "@noctf/mod-team";
import { FastifyInstance } from "fastify";

export default async function (fastify: FastifyInstance) {
  fastify.register(adminConfig);

  fastify.register(auth);
  fastify.register(setup);
  fastify.register(captcha);
  fastify.register(team);
}
