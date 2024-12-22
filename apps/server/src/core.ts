import { routes as adminAuditLog } from "./routes/admin_audit_log.ts";
import { routes as adminConfig } from "./routes/admin_config.ts";
import { routes as adminSetup } from "./routes/admin_setup.ts";
import { routes as challenge } from "./routes/challenge.ts";
import { routes as team } from "./routes/team.ts";

import { initServer as auth } from "@noctf/mod-auth";
import { initServer as captcha } from "@noctf/mod-captcha";
import { initServer as tickets } from "@noctf/mod-tickets";

import type { FastifyInstance } from "fastify";
import { register as configs } from "./modules/configs.ts";
import { AuthnHook } from "./hooks/authn.ts";
import { AuthzHook } from "./hooks/authz.ts";

export default async function (fastify: FastifyInstance) {
  fastify.addHook("preHandler", AuthnHook);
  fastify.addHook("preHandler", AuthzHook);

  fastify.register(configs);

  fastify.register(adminAuditLog);
  fastify.register(adminConfig);
  fastify.register(adminSetup);

  fastify.register(team);

  fastify.register(auth);
  fastify.register(captcha);
  fastify.register(challenge);
  fastify.register(tickets);
}
