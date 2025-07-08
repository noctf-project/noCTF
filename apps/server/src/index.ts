import type { FastifyInstance, FastifyRequest } from "fastify";
import fastify from "fastify";
import { asClass, asFunction, asValue, createContainer } from "awilix";
import { IdentityService } from "@noctf/server-core/services/identity";
import { ConfigService } from "@noctf/server-core/services/config";
import { DatabaseClient } from "@noctf/server-core/clients/database";
import { UserService } from "@noctf/server-core/services/user";
import { ApplicationError } from "@noctf/server-core/errors";
import { TeamService } from "@noctf/server-core/services/team";
import { CacheService } from "@noctf/server-core/services/cache";
import Swagger from "@fastify/swagger";
import SwaggerUI from "@fastify/swagger-ui";
import { fastifyCompress } from "@fastify/compress";
import { fastifyCors } from "@fastify/cors";
import { nanoid } from "nanoid/non-secure";
import { AuditLogService } from "@noctf/server-core/services/audit_log";
import { PolicyService } from "@noctf/server-core/services/policy";
import { RedisClientFactory } from "@noctf/server-core/clients/redis";
import { EventBusService } from "@noctf/server-core/services/event_bus";
import { LockService } from "@noctf/server-core/services/lock";

import {
  POSTGRES_URL,
  TOKEN_SECRET,
  ENABLE_HTTP2,
  LOG_LEVEL,
  METRICS_PATH,
  METRICS_FILE_NAME_FORMAT,
  NATS_URL,
  REDIS_URL,
  ENABLE_SWAGGER,
  ALLOWED_ORIGINS,
  ENABLE_COMPRESSION,
  API_URL,
} from "./config.ts";
import core from "./core.ts";
import { MetricsClient } from "@noctf/server-core/clients/metrics";
import { NATSClientFactory } from "@noctf/server-core/clients/nats";
import { ChallengeService } from "@noctf/server-core/services/challenge/index";
import { FileService } from "@noctf/server-core/services/file/index";
import { ScoreboardService } from "@noctf/server-core/services/scoreboard/index";
import { fastifyMultipart } from "@fastify/multipart";
import { ScoreService } from "@noctf/server-core/services/score";
import { SubmissionService } from "@noctf/server-core/services/submission";
import { RateLimitService } from "@noctf/server-core/services/rate_limit";
import { CompileDomainMatcher } from "./util/domain.ts";
import { EmailService } from "@noctf/server-core/services/email/index";
import { TSchema } from "@sinclair/typebox";
import { BaseResponse } from "@noctf/api/responses";
import { AppService } from "@noctf/server-core/services/app";
import { AsMutable } from "@noctf/server-core/types/primitives";
import { KeyService } from "@noctf/server-core/services/key";
import { DivisionService } from "@noctf/server-core/services/division";
import { TokenService } from "@noctf/server-core/services/token";

export const server = fastify({
  logger: {
    level: LOG_LEVEL,
  },
  disableRequestLogging: true,
  trustProxy: true,
  genReqId: () => nanoid(),
  ...{ http2: ENABLE_HTTP2 }, // typescript is being funny
});
if (ENABLE_COMPRESSION) server.register(fastifyCompress);
(server as AsMutable<FastifyInstance, "apiURL">).apiURL = API_URL;
server.register(fastifyMultipart, {
  limits: {
    fileSize: 1024 * 1024 * 1024, // 1GB
  },
});
server.register(fastifyCors, {
  origin: CompileDomainMatcher(ALLOWED_ORIGINS),
  credentials: true,
  maxAge: 86400,
});

server.register(async () => {
  server.container = createContainer();
  const keyService = new KeyService(TOKEN_SECRET);

  server.container.register({
    logger: asValue(server.log),
    redisClientFactory: asFunction(
      ({ logger }) => new RedisClientFactory(REDIS_URL, logger),
    ).singleton(),
    databaseClient: asFunction(
      ({ logger }) => new DatabaseClient(logger, POSTGRES_URL),
    ).singleton(),
    natsClientFactory: asFunction(
      ({ logger }) => new NATSClientFactory(logger, NATS_URL),
    ).singleton(),
    metricsClient: asFunction(
      ({ logger }) =>
        new MetricsClient(logger, METRICS_PATH, METRICS_FILE_NAME_FORMAT),
    ).singleton(),
    cacheService: asClass(CacheService).singleton(),
    appService: asClass(AppService).singleton(),
    auditLogService: asClass(AuditLogService).singleton(),
    challengeService: asClass(ChallengeService).singleton(),
    emailService: asClass(EmailService).singleton(),
    eventBusService: asClass(EventBusService).singleton(),
    fileService: asClass(FileService).singleton(),
    configService: asClass(ConfigService).singleton(),
    divisionService: asClass(DivisionService).singleton(),
    identityService: asClass(IdentityService).singleton(),
    keyService: asValue(keyService),
    policyService: asClass(PolicyService).singleton(),
    rateLimitService: asClass(RateLimitService).singleton(),
    teamService: asClass(TeamService).singleton(),
    tokenService: asClass(TokenService).singleton(),
    scoreService: asClass(ScoreService).singleton(),
    scoreboardService: asClass(ScoreboardService).singleton(),
    submissionService: asClass(SubmissionService).singleton(),
    userService: asClass(UserService).singleton(),
    lockService: asClass(LockService).singleton(),
  });
  void server.container.cradle.metricsClient.init();
});

if (ENABLE_SWAGGER) {
  server.register(Swagger, {
    openapi: {
      openapi: "3.0.0",
      info: {
        title: "noCTF",
        description: "noCTF backend API",
        version: "0.1.0",
      },
      components: {
        securitySchemes: {
          bearer: {
            type: "http",
            scheme: "bearer",
          },
        },
      },
    },
  });

  server.register(SwaggerUI, {
    routePrefix: "/swagger",
    uiConfig: {
      deepLinking: false,
    },
  });
}

server.register(core);
server.addHook("onRoute", (routeOptions) => {
  if (routeOptions.schema && routeOptions.schema.response) {
    const response = routeOptions.schema.response as { [key: string]: TSchema };
    if (!response["500"]) {
      response["500"] = BaseResponse;
    }
  }
});

const logRequest = async (
  request: FastifyRequest,
  reply: { elapsedTime?: number; statusCode?: number },
  flag?: string,
) => {
  const elapsed = +reply.elapsedTime?.toFixed(2);
  server.log.info(
    {
      elapsed,
      reqId: request.id,
      status: reply.statusCode,
      path: request.originalUrl,
      method: request.method,
      ip: request.ip,
      u: request.user?.id,
      ...(flag && { [flag]: true }),
    },
    "request",
  );
  server.container.cradle.metricsClient.record(
    [
      ["ResponseTime", reply.elapsedTime],
      ["ResponseCount", 1],
    ],
    {
      http_route: request.routeOptions.url || "__notfound__",
      http_method: request.method,
      http_status: Math.floor(reply.statusCode / 100) + "xx",
    },
  );
};

server.addHook("onResponse", async (request, reply) => {
  await logRequest(request, reply);
});
server.addHook("onTimeout", async (request, reply) => {
  await logRequest(request, reply, "timeout");
});
server.addHook("onRequestAbort", async (request) => {
  await logRequest(request, {}, "abort");
});

server.setErrorHandler((error, request, reply) => {
  if (
    error instanceof SyntaxError &&
    request.headers["content-type"] &&
    request.headers["content-type"].startsWith("application/json")
  ) {
    reply
      .status(400)
      .send({ error: "BadRequestError", message: "Invalid JSON" });
    return;
  }
  if (error instanceof ApplicationError) {
    reply
      .status(error.status)
      .send({ error: error.code, message: error.message });
    return;
  }
  if (error.code) {
    switch (error.code) {
      case "FST_ERR_VALIDATION":
        const messages = error.validation.map(
          ({ instancePath, message }) =>
            `${instancePath.substring(1)} ${message}`,
        );
        return reply
          .status(400)
          .send({ error: "ValidationError", message: messages.join("; ") });
      case "FST_ERR_CTP_INVALID_MEDIA_TYPE":
        return reply
          .status(400)
          .send({ error: "UnsupportedMediaTypeError", message: error.message });
      case "FST_INVALID_MULTIPART_CONTENT_TYPE":
        return reply
          .status(400)
          .send({ error: "NotMultipartError", message: error.message });
      default:
        server.log.warn(
          "unexpected possibly fastify error code: %s",
          error.code,
        );
    }
  }
  server.log.error(error, "Request threw unexpected error");
  reply
    .status(500)
    .send({ error: "InternalServerError", message: "Internal Server Error" });
});
