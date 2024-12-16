import { routes as adminAuditLog } from "./routes/admin_audit_log.ts";
import { routes as adminConfig } from "./routes/admin_config.ts";

import { initServer as auth } from "@noctf/mod-auth";
import { initServer as setup } from "@noctf/mod-setup";
import { initServer as captcha } from "@noctf/mod-captcha";
import { initServer as team } from "@noctf/mod-team";
import { initServer as tickets } from "@noctf/mod-tickets";

import { FastifyInstance } from "fastify";
import { AuthnHook } from "./hooks/authn.ts";
import { AuthzHook } from "./hooks/authz.ts";

export default async function (fastify: FastifyInstance) {
  fastify.addHook('preHandler', AuthnHook);
  fastify.addHook('preHandler', AuthzHook);

  fastify.register(adminAuditLog);
  fastify.register(adminConfig);

  fastify.register(auth);
  fastify.register(setup);
  fastify.register(captcha);
  fastify.register(team);
  fastify.register(tickets);
}
