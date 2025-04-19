import { routes as adminAuditLog } from "./routes/admin_audit_log.ts";
import { routes as adminChallenge } from "./routes/admin_challenge.ts";
import { routes as adminConfig } from "./routes/admin_config.ts";
import { routes as adminFile } from "./routes/admin_file.ts";
import { routes as adminSetup } from "./routes/admin_setup.ts";
import { routes as adminSubmission } from "./routes/admin_submission.ts";

import { routes as challenge } from "./routes/challenge.ts";
import { routes as file } from "./routes/file.ts";
import { routes as user } from "./routes/user.ts";
import { routes as team } from "./routes/team.ts";
import { routes as scoreboard } from "./routes/scoreboard.ts";
import { routes as site } from "./routes/site.ts";

import { initServer as auth } from "@noctf/mod-auth";
import { initServer as captcha } from "@noctf/mod-captcha";
import { initServer as tickets } from "@noctf/mod-tickets";
import { initServer as authzServer } from "@noctf/authz-server";

import type { FastifyInstance } from "fastify";
import { AuthnHook } from "./hooks/authn.ts";
import { AuthzHook } from "./hooks/authz.ts";
import { LocalFileProvider } from "@noctf/server-core/services/file/local";
import { FILE_LOCAL_PATH, TOKEN_SECRET } from "./config.ts";
import { RateLimitHook } from "./hooks/rate_limit.ts";
import { NodeMailerProvider } from "@noctf/server-core/services/email/nodemailer";
import { S3FileProvider } from "@noctf/server-core/services/file/s3";

export default async function (fastify: FastifyInstance) {
  fastify.addHook("preHandler", AuthnHook);
  fastify.addHook("preHandler", AuthzHook);
  fastify.addHook("preHandler", RateLimitHook);

  const { configService, emailService, fileService } = fastify.container.cradle;
  fileService.register(new LocalFileProvider(FILE_LOCAL_PATH, TOKEN_SECRET));
  fileService.register(new S3FileProvider());

  emailService.register(new NodeMailerProvider({ configService }));

  fastify.register(adminAuditLog);
  fastify.register(adminChallenge);
  fastify.register(adminConfig);
  fastify.register(adminFile);
  fastify.register(adminSetup);
  fastify.register(adminSubmission);

  fastify.register(challenge);
  fastify.register(file);
  fastify.register(user);
  fastify.register(team);
  fastify.register(scoreboard);
  fastify.register(site);

  fastify.register(auth);
  fastify.register(captcha);
  fastify.register(tickets);
  fastify.register(authzServer);
}
