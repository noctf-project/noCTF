import { routes as adminAuditLog } from "./routes/admin_audit_log.ts";
import { routes as adminChallenge } from "./routes/admin_challenge.ts";
import { routes as adminConfig } from "./routes/admin_config.ts";
import { routes as adminFile } from "./routes/admin_file.ts";
import { routes as adminSetup } from "./routes/admin_setup.ts";
import { routes as adminSubmission } from "./routes/admin_submission.ts";

import { routes as challenge } from "./routes/challenge.ts";
import { routes as user } from "./routes/user.ts";
import { routes as team } from "./routes/team.ts";
import { routes as scoreboard } from "./routes/scoreboard.ts";

import { initServer as auth } from "@noctf/mod-auth";
import { initServer as captcha } from "@noctf/mod-captcha";
import { initServer as tickets } from "@noctf/mod-tickets";
import { initServer as authzServer } from "@noctf/authz-server";

import type { FastifyInstance } from "fastify";
import { AuthnHook } from "./hooks/authn.ts";
import { AuthzHook } from "./hooks/authz.ts";
import { LocalFileProvider } from "@noctf/server-core/services/file";
import { FILE_LOCAL_PATH } from "./config.ts";

export default async function (fastify: FastifyInstance) {
  fastify.addHook("preHandler", AuthnHook);
  fastify.addHook("preHandler", AuthzHook);

  const { fileService } = fastify.container.cradle;
  fileService.register(new LocalFileProvider(FILE_LOCAL_PATH));

  fastify.register(adminAuditLog);
  fastify.register(adminChallenge);
  fastify.register(adminConfig);
  fastify.register(adminFile);
  fastify.register(adminSetup);
  fastify.register(adminSubmission);

  fastify.register(user);
  fastify.register(team);
  fastify.register(scoreboard);

  fastify.register(auth);
  fastify.register(captcha);
  fastify.register(challenge);
  fastify.register(tickets);
  fastify.register(authzServer);
}
