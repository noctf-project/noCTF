import fastify from "fastify";
import {
  POSTGRES_URL,
  HOST,
  PORT,
  TOKEN_SECRET,
  REDIS_URL,
  ENABLE_HTTP2,
} from "./config.ts";
import core from "./core.ts";
import { Service } from "@noctf/server-core";
import {
  asClass,
  asFunction,
  asValue,
  createContainer,
  Lifetime,
} from "awilix";
import { IdentityService } from "@noctf/server-core/services/identity";
import { ConfigService } from "@noctf/server-core/services/config";
import { CacheClient } from "@noctf/server-core/clients/cache";
import { DatabaseClient } from "@noctf/server-core/clients/database";
import { UserService } from "@noctf/server-core/services/user";
import { TokenService } from "@noctf/server-core/services/token";
import { ApplicationError } from "@noctf/server-core/errors";
import { TeamService } from "@noctf/server-core/services/team";
import Swagger from "@fastify/swagger";
import SwaggerUI from "@fastify/swagger-ui";
import { fastifyCompress } from "@fastify/compress";

const server: Service = fastify({
  logger: true,
  ...{ http2: ENABLE_HTTP2 }, // typescript is being funny
}) as unknown as Service;

server.register(fastifyCompress);

server.register(async () => {
  server.container = createContainer();
  const cacheClient = new CacheClient(REDIS_URL);
  await cacheClient.connect();

  server.container.register({
    logger: asValue(server.log),
    cacheClient: asValue(cacheClient),
    databaseClient: asValue(new DatabaseClient(POSTGRES_URL)),
    tokenService: asFunction(
      ({ cacheClient, logger }) =>
        new TokenService({
          cacheClient,
          logger,
          secret: TOKEN_SECRET,
        }),
      { lifetime: Lifetime.SINGLETON },
    ),
    configService: asClass(ConfigService, { lifetime: Lifetime.SINGLETON }),
    identityService: asClass(IdentityService, {
      lifetime: Lifetime.SINGLETON,
    }),
    teamService: asClass(TeamService, { lifetime: Lifetime.SINGLETON }),
    userService: asClass(UserService, { lifetime: Lifetime.SINGLETON }),
  });
});

server.register(Swagger, {
  openapi: {
    openapi: "3.0.0",
    info: {
      title: "noCTF",
      description: "noCTF backend API",
      version: "0.1.0",
    },
  },
});

server.register(SwaggerUI, {
  routePrefix: "/swagger",
  uiConfig: {
    deepLinking: false,
  },
});

server.register(core);

server.setErrorHandler((error, request, reply) => {
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
      default:
        server.log.warn(
          "unexpected possibly fastify error code: %s",
          error.code,
        );
    }
  }
  server.log.error("request threw unexpected error: %s", error.stack);
  reply
    .status(500)
    .send({ error: "InternalServerError", message: "Internal Server Error" });
});

server.listen(
  {
    port: PORT,
    host: HOST,
  },
  (err) => {
    if (err) {
      console.error(err);
      process.exit(1);
    }
  },
);
